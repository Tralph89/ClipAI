/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  searchLiveTrends,
  generateSpeech,
  generateSceneImage,
  animateSceneWithAI,
  generateMusicWithLyria,
  generateSubtitles,
  generateMarketingData,
  dispatchChannelWebhook,
} from './apiService';

import { AspectRatioType } from '../types';
import { generateScript as generateScriptFull } from './apiService';

export async function generateScript(
  prompt: string,
  genre: string,
  subgenre: string,
  duration: string,
  language: string = 'es',
  aspectRatio: AspectRatioType = '9:16',
  channelTone?: string,
  trendContext?: string
): Promise<string> {
  const res = await generateScriptFull(
    prompt,
    genre,
    subgenre,
    duration,
    language,
    aspectRatio,
    channelTone,
    trendContext
  );
  return res.script;
}
