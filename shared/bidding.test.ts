import { describe, it, expect } from 'vitest';
import {
  minNextBid,
  toLowestDenomination,
  MIN_BID_DOP,
  RANKING_WINDOW_DAYS,
  rankingWindowStart,
} from './bidding';

describe('bidding · minNextBid', () => {
  it('ámbito sin líder → mínimo base', () => {
    expect(minNextBid({ leaderTotalDop: 0, myTotalDop: 0, iAmLeader: false })).toBe(MIN_BID_DOP);
  });

  it('detrás del #1 → diferencia + incremento', () => {
    // el #1 lleva 1000, yo llevo 700 → necesito 300 + 100 = 400
    expect(minNextBid({ leaderTotalDop: 1000, myTotalDop: 700, iAmLeader: false })).toBe(400);
  });

  it('empatado con el #1 → solo el incremento', () => {
    expect(minNextBid({ leaderTotalDop: 500, myTotalDop: 500, iAmLeader: false })).toBe(100);
  });

  it('ya soy el #1 → mínimo base para engordar la ventaja', () => {
    expect(minNextBid({ leaderTotalDop: 5000, myTotalDop: 5000, iAmLeader: true })).toBe(MIN_BID_DOP);
  });
});

describe('bidding · toLowestDenomination', () => {
  it('convierte RD$ a centavos', () => {
    expect(toLowestDenomination(250.5)).toBe(25050);
    expect(toLowestDenomination(100)).toBe(10000);
  });
});

describe('bidding · ventana de ranking', () => {
  it('rankingWindowStart es ahora − N días', () => {
    const now = new Date('2026-08-30T12:00:00Z');
    const start = rankingWindowStart(now);
    const days = (now.getTime() - start.getTime()) / 86_400_000;
    expect(days).toBe(RANKING_WINDOW_DAYS);
  });
});
