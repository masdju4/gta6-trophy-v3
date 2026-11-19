// roadmap.js — the platinum route as six ordered stages, built from the trophies'
// official descriptions and the stage/roadmapNote fields in trophies.json.
// Renders stage cards plus a missable watchlist; chips open a trophy's detail.

// The six phases of the route, in order. Titles and blurbs reason from the official
// descriptions: story chapters first, counts and collectibles mid-game, platinum last.
export const STAGES = [
  {
    stage: 1,
    title: 'Prologue & Early Chapters',
    blurb: 'Play the opening mission and Chapters 1–2. Learn the controls, the partner mechanic and the first heist, and start clearing side icons as they appear.',
  },
  {
    stage: 2,
    title: 'Mid-Story Chapters 3–4',
    blurb: 'Push the main path while the map opens up. Catch the missable story beats here — the VCIA escape, the partnership moment and the strange event — and let the choices counter climb.',
  },
  {
    stage: 3,
    title: 'Contacts & the Finale',
    blurb: 'Before the point of no return, finish all five contact strands and the partner heat/robbery trophies. Then complete the final mission for the first gold.',
  },
  {
    stage: 4,
    title: 'Collectibles & Exploration',
    blurb: 'A free-roam sweep: meditation spots, card sets, WAiNK locations, vehicles, areas, garages and the Scooter Bros app. Batch them to cover the map once.',
  },
  {
    stage: 5,
    title: 'Activities, Heists & Money',
    blurb: 'Grind the counts: stunts, range medals, drone races, races, challenges, robberies and the spend/launder totals. All repeatable and unmissable.',
  },
  {
    stage: 6,
    title: '100% & Platinum',
    blurb: 'Close out the 100% completion gold. The platinum then pops automatically once all 54 other trophies are earned.',
  },
];

const GRADE_LABEL = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

// A trophy's display name under the spoiler guard: unearned story trophies mask to ???.
function displayName(trophy, earned, spoilersOn) {
  if (spoilersOn && trophy.kind === 'story' && !earned.has(trophy.name)) return '???';
  return trophy.name;
}

// Render the full roadmap (watchlist + stage cards) into a container.
export function renderRoadmap(container, trophies, { earned, spoilersOn, onSelect }) {
  container.replaceChildren();

  // Missable watchlist — every missable trophy, flagged with its stage.
  const missables = trophies.filter((t) => t.missable);
  const watch = document.createElement('div');
  watch.className = 'missable-watch';
  const watchTitle = document.createElement('h3');
  watchTitle.textContent = `⚠ Missable watchlist (${missables.length}) — earn these before the finale`;
  watch.append(watchTitle);
  const watchList = document.createElement('ul');
  for (const t of missables) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'watch-link';
    btn.textContent = `${displayName(t, earned, spoilersOn)} — stage ${t.stage}`;
    btn.addEventListener('click', () => onSelect(t));
    li.append(btn);
    watchList.append(li);
  }
  watch.append(watchList);
  container.append(watch);

  // One card per stage, trophies in official list order within each stage.
  for (const meta of STAGES) {
    const group = trophies.filter((t) => t.stage === meta.stage).sort((a, b) => a.id - b.id);
    const done = group.filter((t) => earned.has(t.name)).length;

    const card = document.createElement('section');
    card.className = 'stage-card';
    card.dataset.stage = String(meta.stage);

    const head = document.createElement('div');
    head.className = 'stage-head';
    const num = document.createElement('span');
    num.className = 'stage-num';
    num.textContent = String(meta.stage);
    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = meta.title;
    const count = document.createElement('span');
    count.className = 'stage-count';
    count.textContent = `${done}/${group.length} earned`;
    titleWrap.append(title, count);
    head.append(num, titleWrap);

    const blurb = document.createElement('p');
    blurb.className = 'stage-blurb';
    blurb.textContent = meta.blurb;

    const list = document.createElement('ul');
    list.className = 'stage-trophies';
    for (const t of group) {
      const li = document.createElement('li');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stage-chip';
      chip.classList.toggle('is-earned', earned.has(t.name));
      chip.classList.toggle('is-missable', t.missable);

      const dot = document.createElement('span');
      dot.className = `grade-dot grade-${t.grade}`;
      dot.title = GRADE_LABEL[t.grade];
      const name = document.createElement('span');
      name.className = 'chip-name';
      name.textContent = displayName(t, earned, spoilersOn);
      chip.append(dot, name);
      if (t.missable) {
        const flag = document.createElement('span');
        flag.className = 'chip-flag';
        flag.textContent = '⚠';
        flag.title = 'Missable';
        chip.append(flag);
      }
      if (earned.has(t.name)) {
        const tick = document.createElement('span');
        tick.className = 'chip-tick';
        tick.textContent = '✓';
        chip.append(tick);
      }
      chip.addEventListener('click', () => onSelect(t));
      li.append(chip);
      list.append(li);
    }

    card.append(head, blurb, list);
    container.append(card);
  }
}