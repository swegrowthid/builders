import assert from "node:assert/strict";
import test from "node:test";

import { communityGroup, githubHandle } from "../app/lib/community.ts";

test("reads a GitHub handle from a URL, a bare name, or an @name", () => {
  assert.equal(githubHandle("https://github.com/zikrulihsan"), "zikrulihsan");
  assert.equal(githubHandle("https://www.github.com/some-one/"), "some-one");
  assert.equal(githubHandle("github.com/someone"), "someone");
  assert.equal(githubHandle("@someone"), "someone");
  assert.equal(githubHandle("someone"), "someone");
});

test("anything that is not plainly a GitHub account reads as none", () => {
  assert.equal(githubHandle(""), "");
  assert.equal(githubHandle("   "), "");
  assert.equal(githubHandle("https://gitlab.com/someone"), "");
  assert.equal(githubHandle("https://github.com/someone/repo"), "");
  assert.equal(githubHandle("https://github.com/"), "");
  assert.equal(githubHandle("not a handle"), "");
  assert.equal(githubHandle("-leading-dash"), "");
});

function entry(name, { github = "", building = 0, helping = 0 } = {}) {
  return {
    person: { id: name, name, username: name.toLowerCase(), github, skills: [] },
    building: Array.from({ length: building }, (_, index) => ({ id: index })),
    helping: Array.from({ length: helping }, (_, index) => ({ id: index })),
    roles: [],
  };
}

test("contributors are people with GitHub, most helping first", () => {
  const people = [
    entry("Ana", { github: "ana" }),
    entry("Budi", { github: "https://github.com/budi", helping: 2 }),
    entry("Citra", { building: 1 }),
  ];
  assert.deepEqual(communityGroup(people, "contributors").map((e) => e.person.name), ["Budi", "Ana"]);
});

test("founders are people who own a product, and may also be contributors", () => {
  const people = [
    entry("Ana", { github: "ana", building: 1 }),
    entry("Budi", { building: 3 }),
    entry("Citra"),
  ];
  assert.deepEqual(communityGroup(people, "founders").map((e) => e.person.name), ["Budi", "Ana"]);
  assert.deepEqual(communityGroup(people, "contributors").map((e) => e.person.name), ["Ana"]);
});
