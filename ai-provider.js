const SUPPORTED_TONES = new Set([
  'polite',
  'funny',
  'professional',
  'dramatic',
  'chaotic'
]);

const DEFAULT_TONE = 'funny';
const DEFAULT_OPENAI_MODEL = 'gpt-5.2';

function normalizeTone(tone) {
  if (typeof tone !== 'string') {
    return DEFAULT_TONE;
  }

  const normalized = tone.trim().toLowerCase();
  return SUPPORTED_TONES.has(normalized) ? normalized : DEFAULT_TONE;
}

function getAiProvider(env = process.env) {
  const provider = (env.AI_PROVIDER || '').trim().toLowerCase();

  if (provider === 'openai' && env.OPENAI_API_KEY) {
    return createOpenAiProvider(env);
  }

  return null;
}

function createOpenAiProvider(env = process.env) {
  return {
    async generateRejection({ message, tone }) {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const normalizedTone = normalizeTone(tone);

      const response = await client.responses.create({
        model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        instructions: [
          'You generate concise rejection responses for No-as-a-Service.',
          'Return exactly one rejection reason as plain text.',
          'Make it clearly related to the user message.',
          'Do not include markdown, quotes, labels, explanations, or extra options.',
          'Keep it under 35 words.',
          `Tone: ${normalizedTone}.`
        ].join(' '),
        input: `Request to reject: ${message}`,
        max_output_tokens: 80
      });

      const reason = response.output_text && response.output_text.trim();

      if (!reason) {
        throw new Error('OpenAI returned an empty rejection response.');
      }

      return reason;
    }
  };
}

module.exports = {
  DEFAULT_TONE,
  SUPPORTED_TONES,
  getAiProvider,
  normalizeTone
};
