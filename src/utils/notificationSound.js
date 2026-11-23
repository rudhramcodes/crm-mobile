import { createAudioPlayer } from 'expo-audio';
import { getPref, setPref } from './prefs';

// Same setting as the web app's notificationSoundEnabled: on unless turned off. Follows the phone's silent switch.
const KEY = 'notificationSound';
let player = null;

export const isSoundOn = async () => (await getPref(KEY)) !== 'off';
export const setSoundOn = (on) => setPref(KEY, on ? null : 'off');

// "Quiet at night" (off unless turned on): 9 PM to 8 AM on this phone's clock, the same window the server
// holds task pushes in. Banners and sounds the app shows itself go silent; the Inbox still gets everything.
const QUIET_KEY = 'quietHours';
export const QUIET_FROM = 21;
export const QUIET_TO = 8;
export const isQuietOn = async () => (await getPref(QUIET_KEY)) === 'on';
export const setQuietOn = (on) => setPref(QUIET_KEY, on ? 'on' : null);
export const inQuietWindow = (d = new Date()) => d.getHours() >= QUIET_FROM || d.getHours() < QUIET_TO;
export const isQuietNow = async () => inQuietWindow() && (await isQuietOn());

// `test`: the Settings "Test" button plays even inside quiet hours.
export async function playNotificationSound({ test = false } = {}) {
  if (!(await isSoundOn()) || (!test && (await isQuietNow()))) return;
  player ??= createAudioPlayer(require('../../assets/sounds/notification.mp3'));
  player.seekTo(0);
  player.play();
}
