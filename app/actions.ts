"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, requireSupabase, type Supabase } from "./lib/supabase";
import {
  MAXIMUM,
  domainOf,
  normaliseTags,
  slugify,
  validateBrief,
  type FieldErrors,
} from "./lib/brief";
import { isProjectType } from "./lib/project-types";
import { isRole } from "./lib/roles";
import { isStage, meetsStage, settleStage, type Stage } from "./lib/stages";
import { TASK_LIMITS, isTaskStatus, validateTask } from "./lib/tasks";
import { UPDATE_LIMITS, validateUpdate } from "./lib/updates";
import { hiddenFrom } from "./lib/activity";
import { getGitHubProjectDraft, isGitHubRepositoryUrl, type GitHubProjectDraft } from "./lib/github";
import { fetchLinkMetadata, normaliseLink, titleFromLink } from "./lib/link-metadata";
import { currentViewer, viewerId } from "./lib/session";
import { normalisePeopleTerms } from "./lib/people";
import {
  PROFILE_LIMITS,
  PROFILE_MAXIMUM,
  isEmail,
  validateProfile,
  type ProfileFieldErrors,
  type ProfileInput,
} from "./lib/profile";
import {
  EMPTY_FEEDBACK,
  FEEDBACK_LIMITS,
  validateFeedback,
  type FeedbackErrors,
  type FeedbackInput,
} from "./lib/feedback";
import { tags } from "./lib/cache-tags";
import { currentLocale } from "./lib/locale-server";
import { tx, type Locale } from "./lib/locale";

export type CreateState = {
  errors: FieldErrors & {
    form?: string;
    link?: string;
    stage?: string;
    now?: string;
    projectType?: string;
    seatRole?: string;
    seatRoleTitle?: string;
    seatBrief?: string;
    seatCommitment?: string;
    openForGitHubContributions?: string;
  };
  values: Record<string, string>;
};

export type EditState = CreateState;

export type GitHubImportResult =
  | { ok: true; draft: GitHubProjectDraft }
  | { ok: false; error: string };

/** What a pasted link turned out to be, as the form shows it back. */
export type LinkPreview = {
  /** Exactly what was typed, so the form can tell a stale preview from a fresh one. */
  requested: string;
  url: string;
  domain: string;
  title: string;
  tagline: string;
  logoUrl: string;
  imageUrl: string;
  /** False when the page could not be read; the title is then from the address. */
  fetched: boolean;
};

export type LinkPreviewResult =
  | { ok: true; preview: LinkPreview }
  | { ok: false; error: string };

export type ProfileState = {
  errors: ProfileFieldErrors & { form?: string };
  values: ProfileInput;
};

export type FeedbackState = {
  errors: FeedbackErrors & { form?: string };
  values: FeedbackInput;
  /** True once the box has it, so the form can say thank you where it stood. */
  sent?: boolean;
};

const GLYPHS = ["✦", "○○○", "▱", "⌖", "≡", "↗", "◔", "⌁"] as const;

/* ------------------------------------------------------------------ *
 * Retiring what a write has just made wrong
 * ------------------------------------------------------------------ *
 *
 * The public reads in `lib/data.ts` are cached and shared between visitors, so
 * a write has to say what it invalidated or the change would sit unseen behind
 * the cache until it expired on its own.
 *
 * `updateTag` rather than `revalidateTag`: the person who just saved is about
 * to be shown the page they saved. Serving them the previous copy while a fresh
 * one is built in the background — which is what `revalidateTag` does — would
 * read as the edit not having worked.
 *
 * The `revalidatePath` calls below these stay as they were. They clear the
 * router's cache of a rendered route, which is a different store from the
 * tagged data these reads come from; the two are meant to be used together.
 */

/** A project's own page, and every board listing that carries its card. */
function projectChanged(slug: string): void {
  updateTag(tags.project(slug));
  updateTag(tags.projects);
}

/**
 * A seat opened, taken, decided or closed.
 *
 * Wider than one project on purpose: the open-seat counts, the "role yang
 * paling dicari" ranking and the Explore autocomplete are all built from every
 * seat on the site, so any one of them moving dates all of it.
 */
function seatsChanged(slug: string): void {
  projectChanged(slug);
  updateTag(tags.seats);
}

/**
 * Something happened that a trail records.
 *
 * The person's tag covers their profile and, because project trails are filed
 * under the people in them, the projects they already appear on. The project's
 * own tag covers the case this does not: the first time they appear there.
 */
function trailChanged(personId: string | null | undefined, slug?: string): void {
  if (personId) updateTag(tags.trail(personId));
  if (slug) updateTag(tags.projectTrail(slug));
  // The site-wide trail, which Home and Explore lead with: any event by
  // anybody can change what sits at the top of it.
  updateTag(tags.activity);
}

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */

/** Reads public GitHub copy into a browser draft; it never writes a project. */
export async function importGitHubReadme(repoUrl: string): Promise<GitHubImportResult> {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) return { ok: false, error: tx(locale, "Masuk sebelum mengimpor README.", "Sign in before importing a README.") };

  try {
    return { ok: true, draft: await getGitHubProjectDraft(repoUrl) };
  } catch (error) {
    return { ok: false, error: messageOf(error, locale) };
  }
}

/**
 * Reads a pasted link so the form can show what it found.
 *
 * A preview, not a save: the same read runs again inside `createProject` when
 * the browser never got one, so a person who pastes and submits immediately is
 * not punished for being quick.
 */
export async function previewProjectLink(rawLink: string): Promise<LinkPreviewResult> {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) return { ok: false, error: tx(locale, "Masuk sebelum menambahkan proyek.", "Sign in before adding a project.") };

  const link = normaliseLink(rawLink);
  if (!link) return { ok: false, error: tx(locale, "Teks itu belum terlihat seperti tautan.", "That does not look like a link yet.") };

  const metadata = await fetchLinkMetadata(link);
  return {
    ok: true,
    preview: {
      requested: rawLink.trim(),
      url: link,
      domain: metadata.domain || domainOf(link),
      title: metadata.title || titleFromLink(link),
      tagline: metadata.description,
      logoUrl: usableLogo(metadata.iconUrl, metadata.imageUrl),
      imageUrl: metadata.imageUrl,
      fetched: metadata.fetched,
    },
  };
}

/** The detail fields an idea has to answer itself, having no page to be read. */
const REQUIRED_FOR_IDEA = ["tagline", "problem", "solution", "audience"] as const;

const IDEA_PROMPTS: Record<(typeof REQUIRED_FOR_IDEA)[number], (locale: Locale) => string> = {
  tagline: (locale) => tx(locale, "Tuliskan ringkasan satu kalimat tentang idemu.", "Write a one-line summary of your idea."),
  problem: (locale) => tx(locale, "Jelaskan masalah yang ingin kamu selesaikan.", "Describe the problem you want to solve."),
  solution: (locale) => tx(locale, "Jelaskan apa yang sedang atau akan kamu buat.", "Describe what you are making, or plan to make."),
  audience: (locale) => tx(locale, "Sebutkan untuk siapa proyek ini.", "Say who this project is for."),
};

/**
 * Adds a project from either an existing link or the owner's description.
 *
 * A link submission reads the page's title, description and icon when those
 * fields were left empty. A description submission asks for a name and a short
 * explanation instead, so an idea does not need to invent a website before it
 * can exist here. It starts at the Idea stage unless its owner explicitly
 * chooses another stage and supplies the evidence that stage requires.
 */
export async function createProject(_state: CreateState, formData: FormData): Promise<CreateState> {
  const entryMethod = text(formData, "entryMethod") === "description" ? "description" : "link";
  const values = {
    entryMethod,
    link: text(formData, "link"),
    highlight: text(formData, "highlight").slice(0, MAXIMUM.highlight),
    title: text(formData, "title"),
    tagline: text(formData, "tagline"),
    problem: text(formData, "problem"),
    solution: text(formData, "solution"),
    audience: text(formData, "audience"),
    tags: formTopics(formData),
    now: text(formData, "now").slice(0, MAXIMUM.now),
    stage: text(formData, "stage"),
    projectType: text(formData, "projectType"),
    docUrl: text(formData, "docUrl"),
    repoUrl: text(formData, "repoUrl"),
    liveUrl: text(formData, "liveUrl"),
    logoUrl: text(formData, "logoUrl"),
    seatRole: text(formData, "seatRole"),
    seatRoleTitle: text(formData, "seatRoleTitle").slice(0, MAXIMUM.roleTitle),
    seatBrief: text(formData, "seatBrief"),
    seatCommitment: formCommitment(formData, "seatCommitment"),
    openSeat: text(formData, "openSeat"),
    openForGitHubContributions: text(formData, "openForGitHubContributions"),
  };

  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) return { errors: { form: tx(locale, "Masuk sebelum menampilkan proyek di sini.", "Sign in before showing a project here.") }, values };

  const link = entryMethod === "link" ? normaliseLink(values.link) : "";
  if (entryMethod === "link" && !link) {
    return {
      errors: { link: tx(locale, "Tempel tautan proyek—situs web, halaman aplikasi, atau repositori.", "Paste the project link — a website, an app listing, or a repository.") },
      values,
    };
  }
  /*
   * Where the link belongs on the project.
   *
   * A repository is not the same claim as a product: sending a GitHub URL to
   * `live_url` would badge a pile of source code as something other people can
   * use today. Anything else is treated as the thing itself.
   */
  const repoLink = Boolean(link && isGitHubRepositoryUrl(link));
  const repoUrl = values.repoUrl || (repoLink ? link : "");
  const liveUrl = values.liveUrl || (link && !repoLink ? link : "");

  // Only read the page when the person has not already named the project — for
  // anybody who filled the details in themselves there is nothing left to find.
  const metadata = !link || (values.title && values.tagline && values.logoUrl)
    ? null
    : await fetchLinkMetadata(link);
  const title = values.title || metadata?.title || (link ? titleFromLink(link) : "");
  const tagline = values.tagline || (metadata?.description ?? "");
  const logoUrl = values.logoUrl || usableLogo(metadata?.iconUrl, metadata?.imageUrl);

  const brief = {
    ...values,
    title,
    tagline,
    repoUrl,
    liveUrl,
    logoUrl,
  };
  const errors: CreateState["errors"] = validateBrief(brief, locale);
  if (entryMethod === "description" && !values.highlight.trim()) {
    errors.highlight = tx(locale, "Tuliskan deskripsi singkat agar orang memahami idenya.", "Write a short description so people can understand the idea.");
  }
  /*
   * The brief an idea cannot borrow from anywhere else.
   *
   * A link submission is allowed to leave every detail blank because its page
   * answers the same questions; a description-only idea has no page, so the
   * second step is where it becomes readable to a stranger rather than a name
   * and a sentence.
   */
  if (entryMethod === "description") {
    for (const field of REQUIRED_FOR_IDEA) {
      if (!values[field].trim()) errors[field] = IDEA_PROMPTS[field](locale);
    }
  }
  if (values.openSeat === "yes") {
    if (!isRole(values.seatRole)) errors.seatRole = tx(locale, "Pilih peran yang sedang kamu cari.", "Choose the role you are looking for.");
    if (values.seatRole === "other" && !values.seatRoleTitle) {
      errors.seatRoleTitle = tx(locale, "Tuliskan nama peran yang tidak tersedia di katalog.", "Write the name of a role that is not in the catalogue.");
    }
    if (!values.seatBrief) errors.seatBrief = tx(locale, "Jelaskan pekerjaan spesifik yang membutuhkan bantuan.", "Describe the specific work you need help with.");
    if (!values.seatCommitment) {
      errors.seatCommitment = tx(locale, "Berikan perkiraan waktu agar orang tahu apakah mereka dapat bergabung.", "Provide a time estimate so people know whether they can join.");
    }
  }
  if (values.projectType && !isProjectType(values.projectType)) {
    errors.projectType = tx(locale, "Pilih salah satu jenis proyek yang tersedia.", "Choose one of the available project kinds.");
  }
  if (values.openForGitHubContributions === "yes" && !isGitHubRepositoryUrl(repoUrl)) {
    errors.repoUrl = tx(locale, "Untuk membuka kontribusi GitHub, masukkan URL repositori GitHub publik yang valid.", "To open GitHub contributions, enter a valid public GitHub repository URL.");
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  /*
   * The stage nobody explicitly selected.
   *
   * A description-first entry begins as an Idea. For a link entry, a page that
   * opens is evidence a stranger can use the thing today, while a repository
   * is evidence work is happening. Anyone who picked a stage in the details
   * keeps it, and `settleStage` still drops a claim the saved evidence does not
   * support.
   */
  const tags = normaliseTags(values.tags);
  const requestedStage = isStage(values.stage)
    ? values.stage
    : entryMethod === "description"
      ? "idea"
      : repoLink
        ? "building"
        : "live";
  const stage = settleStage(requestedStage, {
    nowText: values.now,
    docUrl: values.docUrl,
    repoUrl,
    liveUrl,
  });

  let slug = "";
  try {
    const supabase = await requireSupabase();
    slug = await freeSlug(supabase, title);

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        slug,
        title,
        tagline,
        owner_id: viewer.id,
        stage,
        project_type: isProjectType(values.projectType) ? values.projectType : "",
        highlight: values.highlight,
        problem: values.problem,
        solution: values.solution,
        audience: values.audience,
        now_text: values.now,
        // The trigger only touches this on UPDATE, so a project that starts
        // life already saying what it is doing gets its first timestamp here.
        now_updated_at: values.now ? new Date().toISOString() : null,
        doc_url: values.docUrl,
        repo_url: repoUrl,
        open_for_github_contributions: values.openForGitHubContributions === "yes",
        live_url: liveUrl,
        logo_url: logoUrl,
        tags,
        glyph: pick(GLYPHS, tagline || title),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (values.openSeat === "yes" && values.seatBrief && isRole(values.seatRole)) {
      const { error: seatError } = await supabase.from("seats").insert({
        project_id: project.id,
        role: values.seatRole,
        role_title: values.seatRole === "other" ? values.seatRoleTitle : "",
        brief: values.seatBrief.slice(0, MAXIMUM.seatBrief),
        commitment: values.seatCommitment,
      });
      if (seatError) throw new Error(seatError.message);
    }
  } catch (error) {
    return { errors: { form: messageOf(error, locale) }, values };
  }

  seatsChanged(slug);
  trailChanged(viewer.id, slug);
  revalidatePath("/");
  redirect(`/projects/${slug}`);
}

/**
 * The mark to store for a project, out of what the page offered.
 *
 * An icon is what a card wants — square, small, already the project's face
 * everywhere else. A social image is the fallback rather than the first choice:
 * it is usually a wide banner with the name written across it, which reads
 * badly at 40 pixels. Either way the column is 500 characters, and a URL longer
 * than that is not worth truncating into a broken image.
 */
function usableLogo(iconUrl?: string, imageUrl?: string): string {
  return [iconUrl, imageUrl].find((url) => url && url.length <= MAXIMUM.logoUrl) ?? "";
}

/**
 * Rewrites a project's brief.
 *
 * The same minimums apply as when it was created, so a project cannot be
 * hollowed out after the fact. The owner can also move its status, as long as
 * the selected status is supported by the brief and links being saved.
 */
export async function updateProject(_state: EditState, formData: FormData): Promise<EditState> {
  const slug = text(formData, "slug");
  const values = {
    title: text(formData, "title"),
    tagline: text(formData, "tagline"),
    highlight: text(formData, "highlight").slice(0, MAXIMUM.highlight),
    problem: text(formData, "problem"),
    solution: text(formData, "solution"),
    audience: text(formData, "audience"),
    tags: formTopics(formData),
    now: text(formData, "now").slice(0, MAXIMUM.now),
    projectType: text(formData, "projectType"),
    docUrl: text(formData, "docUrl"),
    repoUrl: text(formData, "repoUrl"),
    liveUrl: text(formData, "liveUrl"),
    logoUrl: text(formData, "logoUrl"),
    stage: text(formData, "stage"),
    openForGitHubContributions: text(formData, "openForGitHubContributions"),
  };

  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) return { errors: { form: tx(locale, "Masuk untuk mengedit proyek ini.", "Sign in to edit this project.") }, values };

  const errors: EditState["errors"] = validateBrief(values, locale);
  // Empty stays allowed here for the same reason it is allowed in the column:
  // an owner filling in the rest of a link-first project should not be stopped
  // at a question they have no answer for yet.
  if (values.projectType && !isProjectType(values.projectType)) {
    errors.projectType = tx(locale, "Pilih salah satu jenis proyek yang tersedia.", "Choose one of the available project kinds.");
  }
  const requestedStage = isStage(values.stage) ? values.stage : null;
  if (!requestedStage) {
    errors.stage = tx(locale, "Pilih status proyek yang tersedia.", "Choose an available project status.");
  } else if (
    requestedStage === "building" &&
    !values.now &&
    !values.docUrl &&
    !values.repoUrl &&
    !values.liveUrl
  ) {
    errors.now = tx(locale, "Jelaskan pekerjaan yang sedang berjalan atau tambahkan tautan yang dapat diakses.", "Describe the work in progress, or add a working link.");
  } else if (requestedStage === "live" && !values.liveUrl) {
    errors.liveUrl = tx(locale, "Proyek yang sudah berjalan memerlukan tautan yang dapat dibuka orang lain.", "A live project needs a link other people can open.");
  }
  if (values.openForGitHubContributions === "yes" && !isGitHubRepositoryUrl(values.repoUrl)) {
    errors.repoUrl = tx(locale, "Untuk membuka kontribusi GitHub, masukkan URL repositori GitHub publik yang valid.", "To open GitHub contributions, enter a valid public GitHub repository URL.");
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    const supabase = await requireSupabase();
    const { data: project, error } = await supabase
      .from("project_overview")
      .select("id, owner_id, stage")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) return { errors: { form: tx(locale, "Proyek tidak ditemukan.", "Project not found.") }, values };
    if (project.owner_id !== viewer.id) {
      return { errors: { form: tx(locale, "Hanya pemilik proyek yang dapat mengeditnya.", "Only the project owner can edit it.") }, values };
    }

    const tags = normaliseTags(values.tags);
    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({
        title: values.title,
        tagline: values.tagline,
        highlight: values.highlight,
        problem: values.problem,
        solution: values.solution,
        audience: values.audience,
        now_text: values.now,
        doc_url: values.docUrl,
        repo_url: values.repoUrl,
        open_for_github_contributions: values.openForGitHubContributions === "yes",
        live_url: values.liveUrl,
        logo_url: values.logoUrl,
        project_type: values.projectType,
        tags,
        stage: requestedStage,
      })
      .eq("id", project.id)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updatedProject) {
      return {
        errors: { form: tx(locale, "Proyek tidak dapat disimpan. Muat ulang halaman lalu coba lagi.", "The project could not be saved. Refresh the page and try again.") },
        values,
      };
    }
  } catch (error) {
    return { errors: { form: messageOf(error, locale) }, values };
  }

  projectChanged(slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
  redirect(`/projects/${slug}`);
}

/**
 * Removes a project for good, along with its seats, comments and support.
 *
 * Asks for the slug to be typed back because there is no undo — the cascade in
 * the schema takes the discussion with it.
 */
export async function deleteProject(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const confirmation = text(formData, "confirm");
  if (!slug || confirmation !== slug) return;

  const viewer = await currentViewer();
  if (!viewer) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.from("projects").delete().eq("slug", slug);
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  revalidatePath("/");
  redirect(`/u/${viewer.username}`);
}

export async function setStage(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const stage = text(formData, "stage");
  if (!isStage(stage)) return;

  const supabase = await requireSupabase();
  const { data: project, error } = await supabase
    .from("project_overview")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) return;

  const allowed = meetsStage(stage as Stage, {
    nowText: project.now_text ?? "",
    docUrl: project.doc_url,
    repoUrl: project.repo_url,
    liveUrl: project.live_url,
  });
  if (!allowed) return;

  // Ownership is the database's call: the update matches no rows for anybody
  // else. This only decides whether the level itself is earned.
  const { error: updateError } = await supabase
    .from("projects")
    .update({ stage })
    .eq("id", project.id);
  if (updateError) throw new Error(updateError.message);

  projectChanged(slug);
  trailChanged(await viewerId(), slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ *
 * Seats — the open contribution slots
 * ------------------------------------------------------------------ */

export async function openSeat(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const role = text(formData, "role");
  const roleTitle = text(formData, "roleTitle").slice(0, MAXIMUM.roleTitle);
  const brief = text(formData, "brief").slice(0, MAXIMUM.seatBrief);
  const commitment = formCommitment(formData, "commitment");
  if (!isRole(role) || !brief || !commitment || (role === "other" && !roleTitle)) return;

  const supabase = await requireSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return;

  const { error } = await supabase
    .from("seats")
    .insert({
      project_id: project.id,
      role,
      role_title: role === "other" ? roleTitle : "",
      brief,
      commitment,
    });
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  revalidatePath(`/projects/${slug}`);
}

/**
 * Closes a role to new proposals, without touching anybody who already sent
 * one.
 *
 * `DELETE` was the only tool already sitting in the database for this
 * (`managers close seats on their project`, since 0004), but it cascades to
 * every proposal aimed at the seat — including a pending one somebody is
 * still waiting on. This instead flips the seat to `closed`: `submit_proposal`
 * already refuses anything but an `open` seat, so new applicants get turned
 * away, while `decide_proposal` now accepts from `closed` too, so whoever
 * applied before the role closed still gets a real accept or decline.
 */
export async function closeSeat(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const seatId = Number(text(formData, "seatId"));
  if (!Number.isInteger(seatId)) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.from("seats").update({ status: "closed" }).eq("id", seatId);
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/** Submit a proposal for either a role or a concrete unassigned task. */
export async function submitProposal(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const taskId = Number(text(formData, "taskId"));
  const seatId = Number(text(formData, "seatId"));
  const pitch = text(formData, "pitch").slice(0, MAXIMUM.pitch);
  const hasTask = Number.isInteger(taskId) && taskId > 0;
  const hasSeat = Number.isInteger(seatId) && seatId > 0;
  if (hasTask === hasSeat || !pitch) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.rpc("submit_proposal", {
    target_task_id: hasTask ? taskId : null,
    target_seat_id: hasSeat ? seatId : null,
    message: pitch,
  });
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  trailChanged(await viewerId(), slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function decideProposal(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const proposalId = Number(text(formData, "proposalId"));
  const decision = text(formData, "decision");
  if (!Number.isInteger(proposalId) || (decision !== "terima" && decision !== "tolak")) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.rpc("decide_proposal", {
    proposal_id: proposalId,
    accept: decision === "terima",
  });
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  updateTag(tags.projectTrail(slug));
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ *
 * What the project is doing right now, and how it got here
 * ------------------------------------------------------------------ */

/**
 * Rewrites the one line that says what the project is working on.
 *
 * Its own action rather than part of the brief, because it is meant to be
 * changed often — a brief is written once and revisited, this is answered
 * every couple of weeks, and burying it behind the whole edit form is what
 * would make it go stale.
 *
 * `set_now()` rather than a plain update, for the reason `move_task` is a
 * function too: row level security is row level, not column level, so the
 * policy that let an admin write this line would also let them rewrite the
 * brief. The function also settles the level, because clearing the line can
 * cost a project the level it stood on — and `now_updated_at` is written by a
 * trigger, so the freshness people read is never something a request can set.
 */
export async function setNow(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const now = text(formData, "now").slice(0, MAXIMUM.now);

  const supabase = await requireSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return;

  const { error } = await supabase.rpc("set_now", { project: project.id, line: now });
  if (error) throw new Error(error.message);

  projectChanged(slug);
  trailChanged(await viewerId(), slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
  // The same line is editable from the owner's next-steps page.
  revalidatePath("/get-started");
}

/**
 * Adds an entry to the project's journey.
 *
 * Deliberately append-only: `updates` has no UPDATE policy and no update
 * grant, so a log entry can be written and removed but never quietly reworded
 * after people have read it.
 */
export async function postUpdate(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const title = text(formData, "title").slice(0, UPDATE_LIMITS.title.max);
  const body = text(formData, "body").slice(0, UPDATE_LIMITS.body.max);
  if (Object.keys(validateUpdate({ title, body }, await currentLocale())).length > 0) return;

  const viewer = await currentViewer();
  if (!viewer) return;

  const supabase = await requireSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return;

  const { error } = await supabase
    .from("updates")
    .insert({ project_id: project.id, author_id: viewer.id, title, body });
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.updates(slug));
  trailChanged(viewer.id, slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function deleteUpdate(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const updateId = Number(text(formData, "updateId"));
  if (!Number.isInteger(updateId)) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.from("updates").delete().eq("id", updateId);
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.updates(slug));
  revalidatePath(`/projects/${slug}`);
}

/**
 * Follow a project, or stop.
 *
 * Separate from support on purpose: supporting is a verdict, following is an
 * intention to keep watching. Somebody should not have to praise a project to
 * hear about it.
 */
export async function setProjectFollow(
  projectId: number,
  active: boolean,
): Promise<void> {
  const personId = await viewerId();
  if (!personId || !validReactionInput(projectId, active)) throw new Error("Invalid reaction");

  const supabase = await requireSupabase();
  const { error } = active
    ? await supabase.from("follows").upsert(
        { project_id: projectId, user_id: personId },
        { onConflict: "project_id,user_id", ignoreDuplicates: true },
      )
    : await supabase
        .from("follows")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", personId);
  if (error) throw new Error(error.message);

  revalidateTag(tags.projects, "max");
}

/* ------------------------------------------------------------------ *
 * Tasks — what the project is actually working on
 * ------------------------------------------------------------------ */

export async function createTask(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const title = text(formData, "title").slice(0, TASK_LIMITS.title.max);
  const detail = text(formData, "detail").slice(0, TASK_LIMITS.detail.max);
  const assigneeId = text(formData, "assigneeId");
  const rawSeatId = text(formData, "seatId");
  const seatId = rawSeatId ? Number(rawSeatId) : null;
  if (rawSeatId && !Number.isInteger(seatId)) return;
  if (Object.keys(validateTask({ title, detail }, await currentLocale())).length > 0) return;

  const viewer = await currentViewer();
  if (!viewer) return;

  const supabase = await requireSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return;

  // Who may do this is the database's call: the insert policy checks both that
  // the caller manages the project and that the assignee is on it.
  const { error } = await supabase.from("tasks").insert({
    project_id: project.id,
    title,
    detail,
    seat_id: seatId,
    assignee_id: assigneeId || null,
    created_by: viewer.id,
  });
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.tasks(slug));
  trailChanged(viewer.id, slug);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/**
 * Hand a task to somebody, or take it back off them.
 *
 * Editing a task's wording is deliberately not here yet: a text field on every
 * row would bury the list under forms, and knowing who holds what is the part
 * people actually need.
 */
export async function assignTask(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const taskId = Number(text(formData, "taskId"));
  const assigneeId = text(formData, "assigneeId");
  if (!Number.isInteger(taskId)) return;

  const supabase = await requireSupabase();
  const { error } = await supabase
    .from("tasks")
    .update({ assignee_id: assigneeId || null })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.tasks(slug));
  revalidatePath(`/projects/${slug}`);
}

/** Connect or disconnect an existing task from a role on the same project. */
export async function setTaskRole(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const taskId = Number(text(formData, "taskId"));
  const rawSeatId = text(formData, "seatId");
  const seatId = rawSeatId ? Number(rawSeatId) : null;
  if (!Number.isInteger(taskId) || (rawSeatId && !Number.isInteger(seatId))) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.from("tasks").update({ seat_id: seatId }).eq("id", taskId);
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.tasks(slug));
  revalidatePath(`/projects/${slug}`);
}

export async function moveTask(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const taskId = Number(text(formData, "taskId"));
  const status = text(formData, "status");
  if (!Number.isInteger(taskId) || !isTaskStatus(status)) return;

  // move_task rather than an update: row level security cannot narrow a write
  // down to one column, so the assignee gets a function instead of a policy.
  const supabase = await requireSupabase();
  const { error } = await supabase.rpc("move_task", { task_id: taskId, next_status: status });
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.tasks(slug));
  updateTag(tags.projectTrail(slug));
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function deleteTask(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const taskId = Number(text(formData, "taskId"));
  if (!Number.isInteger(taskId)) return;

  const supabase = await requireSupabase();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.tasks(slug));
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function setSeatAccess(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const seatId = Number(text(formData, "seatId"));
  const access = text(formData, "access");
  if (!Number.isInteger(seatId) || (access !== "member" && access !== "admin")) return;

  // Only the owner can land an 'admin' row — the seat policy checks the new
  // value against ownership, not merely against management.
  const supabase = await requireSupabase();
  const { error } = await supabase.from("seats").update({ access }).eq("id", seatId);
  if (error) throw new Error(error.message);

  seatsChanged(slug);
  revalidatePath(`/projects/${slug}`);
}

/* ------------------------------------------------------------------ *
 * Discussion and support
 * ------------------------------------------------------------------ */

export async function addComment(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const body = text(formData, "body").slice(0, MAXIMUM.comment);
  if (!body) return;

  const viewer = await currentViewer();
  if (!viewer) return;

  const supabase = await requireSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return;

  const { error } = await supabase
    .from("comments")
    .insert({ project_id: project.id, author_id: viewer.id, body });
  if (error) throw new Error(error.message);

  projectChanged(slug);
  updateTag(tags.comments(slug));
  trailChanged(viewer.id, slug);
  revalidatePath(`/projects/${slug}`);
}

export async function setProjectBoost(
  projectId: number,
  active: boolean,
): Promise<void> {
  const personId = await viewerId();
  if (!personId || !validReactionInput(projectId, active)) throw new Error("Invalid reaction");

  const supabase = await requireSupabase();
  const { error } = active
    ? await supabase.from("boosts").upsert(
        { project_id: projectId, user_id: personId },
        { onConflict: "project_id,user_id", ignoreDuplicates: true },
      )
    : await supabase
        .from("boosts")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", personId);
  if (error) throw new Error(error.message);

  revalidateTag(tags.projects, "max");
  if (active) {
    revalidateTag(tags.trail(personId), "max");
  }
}

function validReactionInput(projectId: number, active: boolean): boolean {
  return Number.isSafeInteger(projectId) && projectId > 0 && typeof active === "boolean";
}

/**
 * Marks every notice read.
 *
 * A button rather than a side effect of opening /inbox: a page that quietly
 * clears its own badge on render can wipe a decision somebody never actually
 * looked at, and a GET should not change anything anyway. The update matches
 * nothing for anybody else — the policy in 0008 sees to that.
 */
export async function markNoticesSeen(): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer) return;

  const supabase = await requireSupabase();
  const { error } = await supabase
    .from("notices")
    .update({ seen: true })
    .eq("recipient_id", viewer.id)
    .eq("seen", false);
  if (error) throw new Error(error.message);

  // Notices belong to one recipient, so they are never part of a shared cache.
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */

/**
 * Which kinds of trail entry stay public.
 *
 * Separate from updateProfile because it belongs beside the trail rather than
 * beside the bio, and because updateProfile ends in a redirect.
 */
export async function setActivityVisibility(formData: FormData): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer) return;

  const shown = formData.getAll("show").filter((value): value is string => typeof value === "string");

  const supabase = await requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ activity_hidden: hiddenFrom(shown, viewer.activityHidden) })
    .eq("id", viewer.id);
  if (error) throw new Error(error.message);

  trailChanged(viewer.id);
  revalidatePath(`/u/${viewer.username}`);
}

/**
 * Saves the profile, or says what is wrong with it.
 *
 * Takes the `useActionState` shape rather than returning void, because the
 * previous version silently dropped whatever it could not use: a website typed
 * without `https://` became an empty column and the page came back looking as
 * though the edit had been ignored. Now nothing is written until every field
 * is acceptable, and the form comes back with what was typed still in it.
 *
 * `profileUrl` and `profileEmail` below stay in place under the validation.
 * Validation is what turns a mistake into a sentence; those two are what keep
 * an unexpected value out of the row when a request skips the form entirely.
 */
export async function updateProfile(
  _state: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const returnTo = safeProjectReturnTo(text(formData, "returnTo"));
  const values: ProfileInput = {
    name: text(formData, "name"),
    profession: text(formData, "profession"),
    headline: text(formData, "headline"),
    bio: text(formData, "bio"),
    skills: text(formData, "skills"),
    yearsExperience: text(formData, "yearsExperience"),
    fields: text(formData, "fields"),
    availability: text(formData, "availability"),
    website: text(formData, "website"),
    publicEmail: text(formData, "publicEmail"),
    github: text(formData, "github"),
    linkedin: text(formData, "linkedin"),
    x: text(formData, "x"),
    resume: text(formData, "resume"),
  };

  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) {
    return { errors: { form: tx(locale, "Sesi kamu telah berakhir. Masuk kembali, lalu simpan sekali lagi.", "You are no longer signed in. Sign in again, then save once more.") }, values };
  }

  const errors = validateProfile(values, locale);
  if (Object.keys(errors).length > 0) return { errors, values };

  const rawExperience = values.yearsExperience;
  const yearsExperience =
    rawExperience === ""
      ? null
      : Math.max(0, Math.min(Number(rawExperience), PROFILE_LIMITS.yearsExperience));

  const supabase = await requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      name: values.name.slice(0, PROFILE_MAXIMUM.name),
      profession: values.profession.slice(0, PROFILE_MAXIMUM.profession),
      headline: values.headline.slice(0, PROFILE_MAXIMUM.headline),
      bio: values.bio.slice(0, PROFILE_MAXIMUM.bio),
      skills: normalisePeopleTerms(values.skills, PROFILE_LIMITS.skills),
      years_experience: yearsExperience,
      fields: normalisePeopleTerms(values.fields, PROFILE_LIMITS.fields),
      availability_status: values.availability,
      website: profileUrl(values.website),
      public_email: profileEmail(values.publicEmail),
      github: profileUrl(values.github),
      linkedin: profileUrl(values.linkedin),
      x_url: profileUrl(values.x),
      resume_url: profileUrl(values.resume),
    })
    .eq("id", viewer.id);
  if (error) return { errors: { form: error.message }, values };

  updateTag(tags.person(viewer.username));
  updateTag(tags.people);
  updateTag(tags.projects);
  revalidatePath(`/u/${viewer.username}`);
  revalidatePath("/people");
  revalidatePath("/get-started");
  redirect(returnTo ?? `/u/${viewer.username}?saved=1`);
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

/**
 * Sends one masukan to whoever maintains the site.
 *
 * The only write here that does not invalidate anything: nothing on this site
 * reads the `feedback` table, by design — see the migration. That also makes it
 * the only write with no `redirect` at the end. Everywhere else the proof that
 * a save worked is the page it lands on; a masukan has no such page, so the
 * form is told to say so itself, and a bounce to the board would read as the
 * message having been thrown away.
 *
 * A guest may send one. `submit_feedback` decides that, not this function —
 * these checks exist to turn a refusal into a sentence, as everywhere else.
 */
export async function sendFeedback(_state: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const values: FeedbackInput = {
    kind: text(formData, "kind"),
    message: text(formData, "message"),
    contact: text(formData, "contact"),
  };

  const locale = await currentLocale();
  const errors = validateFeedback(values, locale);
  if (Object.keys(errors).length > 0) return { errors, values };

  // Not `requireSupabase`: a checkout with no credentials still renders this
  // page, and the person typing into it deserves a sentence rather than the
  // error boundary swallowing what they wrote.
  const supabase = await getSupabase();
  if (!supabase) {
    return {
      errors: {
        form: tx(
          locale,
          "Situs ini belum terhubung ke Supabase, jadi masukanmu belum bisa dikirim.",
          "This site is not connected to Supabase yet, so your feedback cannot be sent.",
        ),
      },
      values,
    };
  }

  const { error } = await supabase.rpc("submit_feedback", {
    feedback_kind: values.kind,
    message: values.message.slice(0, FEEDBACK_LIMITS.message.max),
    contact: values.contact.slice(0, FEEDBACK_LIMITS.contact.max),
  });
  if (error) return { errors: { form: error.message }, values };

  return { errors: {}, values: EMPTY_FEEDBACK, sent: true };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Never turn a hidden form value into an open redirect. */
function safeProjectReturnTo(value: string): string | null {
  return value.startsWith("/projects/") && !value.startsWith("//") ? value : null;
}

/** Last gate before a link reaches the row, however the request arrived. */
function profileUrl(raw: string): string {
  const value = raw.slice(0, PROFILE_MAXIMUM.link);
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function profileEmail(raw: string): string {
  const value = raw.toLowerCase().slice(0, PROFILE_MAXIMUM.publicEmail);
  return isEmail(value) ? value : "";
}

/** Topic chips and the free-text escape hatch share the old comma-list shape. */
function formTopics(formData: FormData): string {
  const selected = formData
    .getAll("topics")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const custom = text(formData, "customTags");
  const legacy = text(formData, "tags");
  return [...selected, custom || (selected.length === 0 ? legacy : "")].filter(Boolean).join(", ");
}

/** A preset is stored as ordinary copy; custom text takes its place when chosen. */
function formCommitment(formData: FormData, key: string): string {
  const preset = text(formData, `${key}Preset`);
  const custom = text(formData, key);
  return (preset === "custom" ? custom : preset || custom).slice(0, MAXIMUM.commitment);
}

async function freeSlug(supabase: Supabase, title: string): Promise<string> {
  const base = slugify(title);

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const ending = suffix === 0 ? "" : `-${suffix + 1}`;
    const candidate = `${base.slice(0, 48 - ending.length).replace(/-+$/g, "")}${ending}`;
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }

  const ending = `-${Date.now().toString(36)}`;
  return `${base.slice(0, 48 - ending.length).replace(/-+$/g, "")}${ending}`;
}

/** Stable pick so a project keeps the same colour and glyph on every render. */
function pick<T>(options: readonly T[], seed: string): T {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return options[hash % options.length];
}

function messageOf(error: unknown, locale: Locale): string {
  if (error instanceof Error) {
    if (locale === "en") return error.message;
    const known: Record<string, string> = {
      "Only http and https links can be read.": "Hanya tautan http dan https yang dapat dibaca.",
      "A link cannot carry credentials.": "Tautan tidak boleh memuat kredensial.",
      "That address is not publicly reachable.": "Alamat tersebut tidak dapat diakses secara publik.",
      "Use a public GitHub repository URL, for example https://github.com/organization/project.": "Gunakan URL repositori GitHub publik, misalnya https://github.com/organization/project.",
      "That GitHub repository was not found or is not public.": "Repositori GitHub tersebut tidak ditemukan atau tidak bersifat publik.",
      "GitHub is limiting requests. Please try again shortly.": "GitHub sedang membatasi permintaan. Coba lagi sebentar lagi.",
      "GitHub repository data could not be read. Please try again shortly.": "Data repositori GitHub tidak dapat dibaca. Coba lagi sebentar lagi.",
      "The GitHub README could not be read. Please try again shortly.": "README GitHub tidak dapat dibaca. Coba lagi sebentar lagi.",
    };
    return known[error.message] ?? tx(locale, "Terjadi masalah saat menyimpan. Coba lagi sebentar lagi.", error.message);
  }
  return tx(locale, "Terjadi masalah saat menyimpan. Coba lagi sebentar lagi.", "Something went wrong while saving. Please try again shortly.");
}
