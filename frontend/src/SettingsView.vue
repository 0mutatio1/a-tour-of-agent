<template>
  <section class="settings" aria-labelledby="settings-title">
    <div class="settings__message">
      <h1 id="settings-title">Settings</h1>
      <p>Settings are reserved for a later version.</p>
    </div>
  </section>
</template>

<style scoped>
.settings {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 48px;
  background: var(--color-canvas);
}

.settings__message {
  max-width: 440px;
  text-align: center;
}

h1 {
  margin: 0 0 9px;
  color: var(--color-text-subtle);
  font-size: 15px;
  font-weight: 620;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

p {
  margin: 0;
  color: var(--color-text-faint);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .settings {
    min-height: 100dvh;
    padding: 28px 20px;
  }
}
</style>
