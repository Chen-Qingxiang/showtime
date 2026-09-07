(() => {
  'use strict';

  function installLanguageSwitch() {
    const select = document.getElementById('languageSelect');
    if (!select) return false;

    const wrapper = select.closest('.language-control');
    if (!wrapper) return false;
    if (wrapper.querySelector('.language-switch')) return true;

    select.classList.add('language-native-select');

    const button = document.createElement('button');
    button.id = 'languageSwitch';
    button.className = 'language-switch';
    button.type = 'button';
    button.innerHTML = `
      <span class="language-option language-en">EN</span>
      <span class="language-divider" aria-hidden="true"></span>
      <span class="language-option language-zh" lang="zh-CN">中</span>
    `;

    function sync() {
      const language = select.value === 'zh' ? 'zh' : 'en';
      button.dataset.language = language;
      button.setAttribute(
        'aria-label',
        language === 'en'
          ? 'Language: English. Switch to Simplified Chinese'
          : '语言：简体中文。切换到英文'
      );
      button.title = language === 'en' ? 'English / 简体中文' : '简体中文 / English';
    }

    button.addEventListener('click', () => {
      select.value = select.value === 'en' ? 'zh' : 'en';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });

    select.addEventListener('change', sync);
    wrapper.appendChild(button);
    sync();
    return true;
  }

  function start() {
    if (installLanguageSwitch()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (installLanguageSwitch() || attempts >= 20) window.clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
