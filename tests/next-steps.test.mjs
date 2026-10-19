import assert from "node:assert/strict";
import test from "node:test";

import { hasContact, nextSteps, profileReady, remainingSteps } from "../app/lib/next-steps.ts";
import { isTalentPoolMember } from "../app/lib/people.ts";

const emptyPerson = {
  profession: "",
  headline: "",
  bio: "",
  skills: [],
  website: "",
  publicEmail: "",
  github: "",
  linkedin: "",
  x: "",
  resume: "",
};

const filledPerson = {
  ...emptyPerson,
  profession: "Frontend Developer",
  headline: "Membangun antarmuka yang bisa dipakai orang biasa.",
  skills: ["Next.js", "Figma"],
  publicEmail: "halo@contoh.id",
};

const project = (over = {}) => ({ slug: "warung-antre", nowText: "", openSeatCount: 0, ...over });

test("a brand new account owes GitHub, its open source record, and who it is", () => {
  const steps = nextSteps({ person: emptyPerson, owned: [] });
  assert.deepEqual(
    remainingSteps(steps).map((step) => step.id),
    ["github", "oss", "talent"],
  );
});

test("GitHub counts once it reads as an account, in any of the usual spellings", () => {
  const done = (github) => nextSteps({ person: { ...emptyPerson, github }, owned: [] }).find((step) => step.id === "github").done;
  assert.equal(done("https://github.com/someone"), true);
  assert.equal(done("@someone"), true);
  assert.equal(done("https://gitlab.com/someone"), false);
  assert.equal(done("https://github.com/someone/a-repo"), false);
});

test("listing one repo settles the open source step", () => {
  const steps = nextSteps({ person: emptyPerson, owned: [], ossCount: 1 });
  assert.equal(steps.find((step) => step.id === "oss").done, true);
});

test("listing a product is offered, never owed", () => {
  const steps = nextSteps({ person: emptyPerson, owned: [] });
  const productStep = steps.find((step) => step.id === "project");
  assert.equal(productStep.optional, true);
  assert.equal(remainingSteps(steps).includes(productStep), false);
});

test("the product steps stay hidden until there is a product to say them about", () => {
  const steps = nextSteps({ person: emptyPerson, owned: [] });
  assert.equal(steps.some((step) => step.id === "now"), false);
  assert.equal(steps.some((step) => step.id === "role"), false);
});

test("a contributor with GitHub, a record, and a profile owes nothing", () => {
  const steps = nextSteps({ person: { ...filledPerson, github: "https://github.com/someone" }, owned: [], ossCount: 2 });
  assert.deepEqual(remainingSteps(steps), []);
});

test("a founder's product steps are offered, never owed", () => {
  const steps = nextSteps({
    person: { ...filledPerson, github: "someone" },
    owned: [project()],
    ossCount: 1,
  });
  assert.deepEqual(remainingSteps(steps), []);
  assert.ok(steps.find((step) => step.id === "role").optional);
  assert.ok(steps.find((step) => step.id === "now").optional);
});

test("the now step points at a product that has not said anything yet", () => {
  const steps = nextSteps({
    person: filledPerson,
    owned: [project({ slug: "sudah", nowText: "Sedang uji coba." }), project({ slug: "belum" })],
  });
  const now = steps.find((step) => step.id === "now");
  assert.equal(now.href, "/projects/belum");
  // One product speaking is enough for the step itself to be settled.
  assert.equal(now.done, true);
});

test("a profile needs a profession, a skill, and something written", () => {
  assert.equal(profileReady(emptyPerson), false);
  assert.equal(profileReady({ ...emptyPerson, profession: "Desainer" }), false);
  assert.equal(profileReady({ ...emptyPerson, profession: "Desainer", skills: ["Figma"] }), false);
  assert.equal(profileReady(filledPerson), true);
  // Whitespace is not an answer.
  assert.equal(profileReady({ ...filledPerson, profession: "   " }), false);
});

test("the talent pool uses the same ready-profile rule as onboarding", () => {
  const entry = (person) => ({ person, building: [], helping: [], roles: [] });

  assert.equal(isTalentPoolMember(entry(emptyPerson)), false);
  assert.equal(isTalentPoolMember(entry(filledPerson)), true);
});

test("any one public link is enough to be reachable", () => {
  assert.equal(hasContact(emptyPerson), false);
  assert.equal(hasContact({ ...emptyPerson, resume: "https://contoh.id/cv.pdf" }), true);
  assert.equal(hasContact({ ...emptyPerson, github: "  " }), false);
});
