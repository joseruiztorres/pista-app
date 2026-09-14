import { supabase } from './supabase';

// Revisa la racha actual y otorga (upsert, sin duplicar) las medallas de
// constancia que ya se hayan alcanzado. Se llama después de cada marcaje
// del reto diario.
export async function checkStreakBadges(profileId) {
  if (!profileId) return;
  const { data: streakVal } = await supabase.rpc('current_streak', { p_profile_id: profileId });
  const streak = streakVal || 0;
  const milestones = [[3, 'streak_3'], [7, 'streak_7'], [30, 'streak_30']];
  const earned = milestones.filter(([n]) => streak >= n).map(([, id]) => id);
  if (earned.length === 0) return;
  await supabase.from('profile_badges')
    .upsert(earned.map((badge_id) => ({ profile_id: profileId, badge_id })), {
      onConflict: 'profile_id,badge_id',
      ignoreDuplicates: true,
    });
}

// Otorga la medalla de primera publicación. Se llama tras crear un post.
export async function checkFirstPostBadge(profileId) {
  if (!profileId) return;
  await supabase.from('profile_badges')
    .upsert({ profile_id: profileId, badge_id: 'first_post' }, {
      onConflict: 'profile_id,badge_id',
      ignoreDuplicates: true,
    });
}
