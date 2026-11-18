/* platform.js — единственное место, которое знает про площадку.
   Telegram сейчас; Яндекс/VK/Capacitor потом — менять только этот файл. */
(function (root) {
  'use strict';
  var tg = (root.Telegram && root.Telegram.WebApp) ? root.Telegram.WebApp : null;
  var KEY = 'ork_td_v1';

  var P = {
    tg: tg,
    ready: function () {
      if (!tg) return;
      try {
        tg.ready(); tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.setHeaderColor) tg.setHeaderColor('#23241d');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#14150f');
      } catch (e) {}
    },
    haptic: function (kind) {
      if (tg && tg.HapticFeedback) {
        try {
          if (kind === 'error') tg.HapticFeedback.notificationOccurred('error');
          else if (kind === 'success') tg.HapticFeedback.notificationOccurred('success');
          else tg.HapticFeedback.impactOccurred(kind || 'light');
          return;
        } catch (e) {}
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(kind === 'error' ? [30, 25, 55] : kind === 'heavy' ? 18 : 9); } catch (e) {}
      }
    },
    save: function (obj) {
      try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
    },
    load: function () {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
    }
  };
  root.Platform = P;
})(window);
