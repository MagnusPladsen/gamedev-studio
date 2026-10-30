import type { ExampleModule } from "./types";

// Example assets for: stories, notes. The sample game is "Pip's Quest".

const stories: ExampleModule = {
  collection: "stories",
  build: ({ id }) => [
    {
      id: id("hero"),
      title: "Pip",
      type: "character",
      links: [],
      tags: ["protagonist", "player"],
      content: `A small, stubborn kid from [[Mossbrook Village]] who wants to prove everyone wrong. The player character.

## Appearance
- Short, green hood that's two sizes too big
- Carries a wooden practice sword until finding the [[Sunsteel Sword]]

## Personality
- Brave but impatient
- Talks to slimes as if they were pets
- Trusts [[Elder Maren]] more than anyone

## Backstory
Found as a baby on the steps of the village well the night of [[The Great Fall]]. Raised by [[Elder Maren]].

## In the game
- Can jump, double-jump after the first shrine, and swing a sword
- Starts the quest in [[The Lost Sword]]`,
    },
    {
      id: id("village"),
      title: "Mossbrook Village",
      type: "location",
      links: [],
      tags: ["hub", "safe-zone"],
      content: `A sleepy village of mossy roofs on the edge of the [[Whispering Forest]]. Home of [[Pip]] and [[Elder Maren]].

## Description
Stone paths, a mill wheel that squeaks, and a well everyone avoids after dark.

## Notable places
- Elder's house: where [[The Lost Sword]] quest starts
- Tobb's stall: Merchant Tobb sells hearts and coins
- The north gate: guarded, leads to the [[Whispering Forest]]

## Level
The first level, *Mossbrook Meadow*, is the field just outside the village.`,
    },
    {
      id: id("sword"),
      title: "Sunsteel Sword",
      type: "item",
      links: [],
      tags: ["weapon", "key-item"],
      content: `An old blade that glows warm yellow near shadow creatures. Lost in the [[Whispering Forest]] since [[The Great Fall]].

## Properties
- Deals double damage to shadow enemies
- Lights up dark rooms in a small circle
- Needed to open the [[The Shadow King]]'s door

## Where to find it
At the end of [[The Lost Sword]] quest, guarded by a big slime.`,
    },
    {
      id: id("elder"),
      title: "Elder Maren",
      type: "character",
      links: [],
      tags: ["npc", "quest-giver"],
      content: `The oldest person in [[Mossbrook Village]] and [[Pip]]'s guardian. Knows more about [[The Great Fall]] than she admits.

## Appearance
Walking stick with a lantern hanging from it. Always has flour on her sleeves.

## Personality
- Calm, a little sarcastic
- Worries about Pip but never says so

## Role in the game
Gives the first quest, [[The Lost Sword]]. Her dialogue explains the double-jump.`,
    },
    {
      id: id("forest"),
      title: "Whispering Forest",
      type: "location",
      links: [],
      tags: ["level", "dangerous"],
      content: `A dense forest north of [[Mossbrook Village]]. The trees whisper the player's name when they stand still.

## Description
Tall dark trees, mushroom platforms, slime pools.

## Enemies
- Slimes (see the *Slime AI* diagram)
- Shadow bats near the end

## Secrets
The [[Sunsteel Sword]] rests in a clearing at the forest's heart.`,
    },
    {
      id: id("shadow-king"),
      title: "The Shadow King",
      type: "character",
      links: [],
      tags: ["villain", "boss"],
      content: `A king who was sealed away during [[The Great Fall]]. His seal is weakening.

## Appearance
A tall crown with no face underneath. Moves by melting into the floor.

## Motivation
Wants the light of the [[Sunsteel Sword]] put out for good.

## Boss fight
- Phase 1: sinks and rises under the player
- Phase 2: summons slimes from the [[Whispering Forest]]
- Only the [[Sunsteel Sword]] can hurt him`,
    },
    {
      id: id("quest-sword"),
      title: "The Lost Sword",
      type: "quest",
      links: [],
      tags: ["main-quest", "act-1"],
      content: `The first main quest. [[Elder Maren]] asks [[Pip]] to bring back the [[Sunsteel Sword]].

## Goal
Find the sword in the [[Whispering Forest]] and return to [[Mossbrook Village]].

## Steps
- Talk to [[Elder Maren]]
- Get past the gate guard (needs 3 coins or the elder's note)
- Cross the forest and beat the big slime
- Bring the sword home

## Reward
The [[Sunsteel Sword]] and the double-jump.`,
    },
    {
      id: id("lore-fall"),
      title: "The Great Fall",
      type: "lore",
      links: [],
      tags: ["history"],
      content: `Fifty years ago a star fell into the [[Whispering Forest]]. Its metal became the [[Sunsteel Sword]], and its light sealed [[The Shadow King]] underground.

## What people believe
- Villagers think it was a punishment
- [[Elder Maren]] says it was a gift

## Why it matters
The seal only lasts as long as the sword's light. That's why [[Pip]]'s quest is urgent.`,
    },
  ],
};

const notes: ExampleModule = {
  collection: "notes",
  legacyNames: ["Welcome to your notebook"],
  build: ({ id }) => [
    {
      id: id("welcome"),
      title: "Welcome to your notebook",
      folder: "Getting started",
      pinned: true,
      tags: ["getting-started"],
      content: `Use the notebook for ideas, to-dos and design notes while you build your game.

- [x] Open the notebook
- [ ] Write down your game idea
- [ ] Link this note to a sprite or sound with **+ Link** below
- [ ] Click a checkbox in the preview to tick it off

Type \`[[\` to link to another note or a story entry, like [[Pip's Quest — design doc]].
`,
    },
    {
      id: id("design-doc"),
      title: "Pip's Quest — design doc",
      folder: "Design",
      pinned: true,
      tags: ["design", "gdd"],
      content: `## Pitch
A short, cosy platformer: [[Pip]] leaves [[Mossbrook Village]] to bring back the [[Sunsteel Sword]] before [[The Shadow King]] wakes up.

## Core loop
1. Explore a level and collect coins
2. Avoid or bounce on slimes
3. Reach the shrine at the end to unlock a new move

## Controls
- **Left / Right** or **A / D**: move
- **Space**: jump (hold for higher)
- **J**: swing sword (after [[The Lost Sword]])

## Art style
16×16 pixel art, 4–6 colours per sprite, the *Meadow* palette for outdoor levels.

## Audio
Chiptune. *Title Theme* on the menu, *Overworld* in levels, *Boss Battle* for the king. Short, punchy SFX for jump and coin.

## Scope
- 3 levels + 1 boss
- About 20 minutes to finish
- Screen flow: see the *Screen Flow* diagram
`,
    },
    {
      id: id("todo"),
      title: "To-do: first playable",
      folder: "Production",
      pinned: false,
      tags: ["todo", "milestone"],
      content: `Goal: one level you can play from start to end.

- [x] Draw Pip's walk cycle
- [x] Make jump and coin sounds
- [x] Paint the Mossbrook Meadow tilemap
- [ ] Add slime enemy with patrol AI
- [ ] Write Elder Maren's quest dialogue
- [ ] Hook up the title screen
- [ ] Playtest with two friends and write notes
`,
    },
    {
      id: id("bugs"),
      title: "Bug list",
      folder: "Production",
      pinned: false,
      tags: ["bugs"],
      content: `- [x] Pip can jump again in mid-air after walking off a ledge (added coyote time limit)
- [ ] Holding jump against a wall makes Pip stick to it
- [ ] Coin sound plays twice when two coins are touched in the same frame
- [ ] Slimes walk off platform edges instead of turning around
- [ ] Camera jitters when Pip lands on a moving platform

Tip: describe *what you did*, *what happened* and *what you expected*.
`,
    },
  ],
};

export const writingExamples: ExampleModule[] = [stories, notes];
