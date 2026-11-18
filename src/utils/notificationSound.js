import { createAudioPlayer } from 'expo-audio';
import { getPref, setPref } from './prefs';

// Same setting as the web app's notificationSoundEnabled: on unless turned off. Follows the phone's silent switch.
const KEY = 'notificationSound';
let player = null;

export const isSoundOn = async () => (await getPref(KEY)) !== 'off';
export const setSoundOn = (on) => setPref(KEY, on ? null : 'off');

export async function playNotificationSound() {
  if (!(await isSoundOn())) return;
  player ??= createAudioPlayer(require('../../assets/sounds/notification.mp3'));
  player.seekTo(0);
  player.play();
}
