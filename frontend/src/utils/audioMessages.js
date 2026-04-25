import { PRIORITY_MAP } from '../components/DrishtiConstants';

const MODE_COOLDOWNS = {
  NORMAL: 3000,
  HOME: 3500,
  OUTDOOR: 2500,
  SHOPPING: 2500,
  SOCIAL: 4000,
  PATHFINDER: 1500,
  EMERGENCY: 700,
  COUNT: 6000,
  CONVERSATION: 4000,
  SILENT: Number.POSITIVE_INFINITY,
};

const MODE_LIMITS = {
  NORMAL: 4,
  HOME: 3,
  OUTDOOR: 4,
  SHOPPING: 4,
  SOCIAL: 3,
  PATHFINDER: 2,
  EMERGENCY: 2,
  COUNT: 1,
  CONVERSATION: 4,
};

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

function getFriendlyLabel(label = '') {
  return label.replace(/_/g, ' ').trim() || 'object';
}

export function getDirection(cx = 320) {
  if (cx < 128) return 'far left';
  if (cx < 256) return 'left';
  if (cx < 384) return 'ahead';
  if (cx < 512) return 'right';
  return 'far right';
}

export function getDistance(w = 0, h = 0) {
  const size = Math.max(w, h);
  if (size > 450) return { word: 'very close', rank: 4, isUrgent: true };
  if (size > 280) return { word: 'nearby', rank: 3, isUrgent: true };
  if (size > 140) return { word: 'a few steps away', rank: 2, isUrgent: false };
  if (size > 70) return { word: 'in the distance', rank: 1, isUrgent: false };
  return { word: 'far away', rank: 0, isUrgent: false };
}

function getPriority(label) {
  return PRIORITY_MAP[label] ?? PRIORITY_MAP.default ?? 0;
}

function describeDetection(det) {
  const spokenLabel = det.displayLabel || det.customLabel || det.label;
  const baseLabel = det.baseLabel || det.label;
  const friendlyLabel = getFriendlyLabel(spokenLabel);
  const distance = getDistance(det.w, det.h);

  return {
    ...det,
    friendlyLabel,
    baseLabel,
    direction: getDirection(det.cx),
    distanceWord: distance.word,
    distanceRank: distance.rank,
    isUrgent: distance.isUrgent,
    priority: getPriority(baseLabel),
    area: (det.w || 0) * (det.h || 0),
    confidence: det.confidence ?? det.score ?? 0,
  };
}

function sortDetections(detections = []) {
  return detections
    .map(describeDetection)
    .sort((a, b) =>
      (b.isUrgent - a.isUrgent) ||
      (b.priority - a.priority) ||
      (b.distanceRank - a.distanceRank) ||
      (b.area - a.area) ||
      (b.confidence - a.confidence)
    );
}

function limitByMode(detections, mode) {
  const limit = MODE_LIMITS[mode] ?? 4;
  return detections.slice(0, limit);
}

function buildIndexedLabel(label, index, total) {
  if (total <= 1) return label;
  const countWord = COUNT_WORDS[index] ?? String(index);
  return `${label} ${countWord}`;
}

function buildObjectPhrase(det, index, total, includeDistance = true) {
  const indexedLabel = buildIndexedLabel(det.friendlyLabel, index, total);
  if (includeDistance) {
    return `${indexedLabel} ${det.distanceWord} on your ${det.direction}`;
  }
  return `${indexedLabel} on your ${det.direction}`;
}

function buildObjectListMessage(detections, mode, includeDistance = true) {
  if (!detections.length) {
    return mode === 'PATHFINDER' ? 'Path clear.' : '';
  }

  const counts = detections.reduce((acc, det) => {
    acc[det.friendlyLabel] = (acc[det.friendlyLabel] || 0) + 1;
    return acc;
  }, {});

  const seen = {};
  const parts = detections.map((det) => {
    seen[det.friendlyLabel] = (seen[det.friendlyLabel] || 0) + 1;
    return buildObjectPhrase(det, seen[det.friendlyLabel], counts[det.friendlyLabel], includeDistance);
  });

  return parts.join('. ') + '.';
}

function buildCountMessage(detections) {
  if (!detections.length) return '';

  const tally = detections.reduce((acc, det) => {
    acc[det.friendlyLabel] = (acc[det.friendlyLabel] || 0) + 1;
    return acc;
  }, {});

  const summary = Object.entries(tally)
    .sort((a, b) => getPriority(b[0]) - getPriority(a[0]) || b[1] - a[1])
    .map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`)
    .join(', ');

  return `I can detect ${summary}.`;
}

function buildPathfinderMessage(detections, isPathSafe) {
  if (isPathSafe || detections.length === 0) return 'Path clear.';

  const critical = detections.filter(
    (det) => det.direction === 'ahead' || det.distanceRank >= 3 || det.isUrgent
  );

  if (!critical.length) return 'Caution. Obstacle near your path.';

  return `Stop. ${buildObjectListMessage(critical.slice(0, 2), 'PATHFINDER', false)}`;
}

function buildEmergencyMessage(detections) {
  if (!detections.length) return '';
  return `Danger. ${buildObjectListMessage(detections.slice(0, 2), 'EMERGENCY', true)}`;
}

export function buildAudioMessage(detections, mode, isPathSafe = true) {
  if (!detections || detections.length === 0) {
    return mode === 'PATHFINDER' ? 'Path clear.' : '';
  }

  if (mode === 'SILENT') return '';

  const sorted = limitByMode(sortDetections(detections), mode);

  switch (mode) {
    case 'COUNT':
      return buildCountMessage(sortDetections(detections));
    case 'PATHFINDER':
      return buildPathfinderMessage(sorted, isPathSafe);
    case 'EMERGENCY':
      return buildEmergencyMessage(sorted);
    case 'SHOPPING':
      return buildObjectListMessage(sorted, mode, false);
    case 'HOME':
    case 'SOCIAL':
    case 'NORMAL':
    case 'OUTDOOR':
    case 'CONVERSATION':
    default:
      return buildObjectListMessage(sorted, mode, true);
  }
}

export { MODE_COOLDOWNS };

export function shouldSpeak(mode, lastSpokenTimestamp) {
  const cooldown = MODE_COOLDOWNS[mode] ?? 3000;
  return Date.now() - lastSpokenTimestamp > cooldown;
}

export function isUrgentSituation(detections = [], mode, isPathSafe) {
  if (mode === 'EMERGENCY') return true;
  if (mode === 'PATHFINDER' && !isPathSafe) return true;

  return detections.some((det) => getDistance(det.w, det.h).isUrgent || getPriority(det.label) >= 90);
}
