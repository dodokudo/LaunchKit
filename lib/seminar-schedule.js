'use strict';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const JOIN_LEAD_MS = 10 * 60 * 1000;
const VIDEO_DURATION_MS = 7_341_461;
const START_HOURS = [13, 21];

function jstParts(timestampMs) {
  const date = new Date(timestampMs + JST_OFFSET_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function jstTimestamp({ year, month, day }, hour) {
  return Date.UTC(year, month, day, hour, 0, 0, 0) - JST_OFFSET_MS;
}

function addJstDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function sessionsForDay(parts) {
  return START_HOURS.map((hour) => {
    const startsAtMs = jstTimestamp(parts, hour);
    return {
      startsAtMs,
      joinOpensAtMs: startsAtMs - JOIN_LEAD_MS,
      endsAtMs: startsAtMs + VIDEO_DURATION_MS,
    };
  });
}

function getSeminarState(nowMs = Date.now()) {
  const today = jstParts(nowMs);
  const todaySessions = sessionsForDay(today);

  const liveSession = todaySessions.find(
    (session) => nowMs >= session.startsAtMs && nowMs < session.endsAtMs
  );
  if (liveSession) {
    return { status: 'live', session: liveSession, nextSession: null };
  }

  const waitingSession = todaySessions.find(
    (session) => nowMs >= session.joinOpensAtMs && nowMs < session.startsAtMs
  );
  if (waitingSession) {
    return { status: 'waiting', session: waitingSession, nextSession: null };
  }

  const nextToday = todaySessions.find((session) => nowMs < session.joinOpensAtMs);
  const nextSession = nextToday || sessionsForDay(addJstDays(today, 1))[0];
  return { status: 'closed', session: null, nextSession };
}

module.exports = {
  JOIN_LEAD_MS,
  START_HOURS,
  VIDEO_DURATION_MS,
  getSeminarState,
};
