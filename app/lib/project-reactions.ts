export type ProjectReactionState = {
  following: boolean;
  followerCount: number;
  boosted: boolean;
  boostCount: number;
};

export type ProjectReaction =
  | { kind: "follow"; active: boolean }
  | { kind: "boost"; active: boolean };

export function applyProjectReaction(
  state: ProjectReactionState,
  reaction: ProjectReaction,
): ProjectReactionState {
  if (reaction.kind === "follow") {
    const difference = Number(reaction.active) - Number(state.following);
    return {
      ...state,
      following: reaction.active,
      followerCount: Math.max(0, state.followerCount + difference),
    };
  }

  const difference = Number(reaction.active) - Number(state.boosted);
  return {
    ...state,
    boosted: reaction.active,
    boostCount: Math.max(0, state.boostCount + difference),
  };
}
