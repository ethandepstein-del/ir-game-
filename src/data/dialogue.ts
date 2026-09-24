import type { LeaderType } from '../engine/types';

export type Reaction =
  | 'opening'
  | 'accept'
  | 'counter'
  | 'lowball'
  | 'generous'
  | 'mobilize'
  | 'warning'
  | 'warningIgnored'
  | 'tieHands'
  | 'goodwill'
  | 'backchannel'
  | 'mediator'
  | 'ultimatumAccept'
  | 'ultimatumReject'
  | 'provoke'
  | 'counterMobilize'
  | 'ratFail'
  | 'noTrust'
  | 'acceptTheirs';

type Lines = Record<Reaction, string[]>;

const common: Lines = {
  opening: ['Let us see whether {you} came here to talk or to lecture.'],
  accept: ['We can live with this. Draft the text.', 'Agreed. Let the lawyers earn their fees.', 'This is acceptable to {them}.'],
  counter: [
    'Not quite. Here is what {them} can accept.',
    'Closer. Consider our revised terms.',
    'We are moving. Are you?',
  ],
  lowball: ['Is this a joke? My ministers will laugh at it.', 'You insult us. Try again when you are serious.'],
  generous: ['...That is a serious offer. We note it.'],
  mobilize: ['Troop movements. Very well.'],
  warning: ['Words.'],
  warningIgnored: ['We have heard such speeches before. They rarely end in action.'],
  tieHands: ['You have boxed yourself in. Interesting.'],
  goodwill: ['A gesture. We will see if it lasts.'],
  backchannel: ['(Your back channel reports in.)'],
  mediator: ['We will hear the mediator out.'],
  ultimatumAccept: ['You leave us little choice. We accept, and we will remember how this was done.'],
  ultimatumReject: ['{them} does not negotiate at gunpoint. We are finished here.'],
  provoke: ['Our forces will conduct exercises near the line. Routine, of course.'],
  counterMobilize: ['You mobilize, so we mobilize. You started this.'],
  ratFail: ['Your own parliament rejects your signature? Then what is your word worth?'],
  noTrust: ['The terms might work. But how do we know you will honor them? We need more than paper.'],
  acceptTheirs: ['Then we have an agreement. Good.'],
};

const byType: Record<LeaderType, Partial<Lines>> = {
  opportunist: {
    opening: ['{them} has claims in this matter that are not open to debate. The question is what {you} will offer to calm things down.'],
    mobilize: ['Hm. Perhaps we have been... hasty. Let us speak more practically.', 'Your troops do not frighten us. (He looks at his aides, then at his papers.)'],
    goodwill: ['A kind gesture. It suggests you want this more than we do.', 'We accept your gesture. We also note what it tells us.'],
    warning: ['Bold words. We will see.'],
    tieHands: ['A red line. Well. We will work around it, for now.'],
    ultimatumAccept: ['Fine. Take your treaty.'],
  },
  insecure: {
    opening: ['{them} has been threatened and encircled for a generation. We came because we want this to end, but not on our knees.'],
    mobilize: [
      'You move troops while we talk? This confirms everything my generals say about you.',
      'So the mask comes off. My government will not be bullied.',
    ],
    goodwill: ['That is... appreciated. Genuinely. Perhaps there is a way forward.', 'Thank you. My colleagues will find it harder to call you an enemy now.'],
    warning: ['Threats. Always threats. How do you expect us to trust you?'],
    tieHands: ['You draw lines as if we are the aggressor.'],
    counterMobilize: ['We have no choice but to match your deployments. You understand this is defensive.'],
  },
  pragmatist: {
    opening: ['Let us skip the speeches. There is a deal here somewhere. Let us find it before the generals do.'],
    mobilize: ['A costly move. Noted. We are recalculating.'],
    goodwill: ['Good. That helps. Let us keep that spirit.'],
    warning: ['Understood. Let us focus on the text.'],
    tieHands: ['A domestic constraint. Understood. We will factor it in.'],
  },
};

export function line(type: LeaderType, reaction: Reaction, roll: number): string {
  const pool = byType[type][reaction] ?? common[reaction];
  return pool[Math.floor(roll * pool.length) % pool.length];
}

export const TYPE_INFO: Record<LeaderType, { name: string; model: string; summary: string }> = {
  opportunist: {
    name: 'The Opportunist',
    model: 'deterrence-model',
    summary:
      'Driven by ambition, not fear. Goodwill read as weakness and pushed for more. Firmness and costly signals got results. Toughness was the right call.',
  },
  insecure: {
    name: 'The Insecure State',
    model: 'spiral-model',
    summary:
      'Driven by fear of you. Shows of force confirmed that fear and drew counter-escalation. Reassurance and reciprocity lowered demands. Toughness backfired.',
  },
  pragmatist: {
    name: 'The Pragmatist',
    model: 'bargaining-war',
    summary:
      'A cool calculator who responded moderately to both threats and gestures, and mostly to the numbers on the table. Clear packages and good information won the day.',
  },
};
