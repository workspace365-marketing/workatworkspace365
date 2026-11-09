// Draait elke ochtend en start een nieuwe build, zodat nieuwe of gesloten vacatures
// uit Recruitee binnen een dag op de site staan.
// Vereist de omgevingsvariabele BUILD_HOOK_URL (Netlify: Site configuration > Build & deploy > Build hooks).
export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    console.warn('BUILD_HOOK_URL ontbreekt, geen build gestart.');
    return;
  }
  const res = await fetch(hook, { method: 'POST' });
  console.log('Build gestart:', res.status);
};

export const config = { schedule: '30 5 * * *' };
