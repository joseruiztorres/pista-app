// Helpers para el centro de notificaciones: icono y texto por tipo.
// `data` es JSONB libre (post_id, meetup_id, conversation_id, badge_id...)

export function iconForNotif(type) {
  switch (type) {
    case 'follow': return 'person-add-outline';
    case 'like': return 'heart';
    case 'comment': return 'chatbubble-outline';
    case 'badge': return 'ribbon-outline';
    case 'meetup_join': return 'location-outline';
    case 'message': return 'chatbubble-ellipses-outline';
    case 'follow_request': return 'person-add-outline';
    case 'follow_accept': return 'checkmark-circle-outline';
    case 'social_challenge_invite': return 'people-circle-outline';
    case 'social_challenge_join': return 'person-add-outline';
    case 'social_challenge_complete': return 'trophy-outline';
    default: return 'notifications-outline';
  }
}

function actorName(n) {
  return n.actor?.display_name || n.actor?.username || 'Alguien';
}

export function textForNotif(n) {
  const name = actorName(n);
  switch (n.type) {
    case 'follow': return `${name} empezó a seguirte`;
    case 'like': return `${name} le dio like a tu publicación`;
    case 'comment': return `${name} comentó tu publicación`;
    case 'badge': return `Has conseguido una medalla nueva`;
    case 'meetup_join': return `${name} se apuntó a tu quedada`;
    case 'message': return `${name} te ha enviado un mensaje`;
    case 'follow_request': return `${name} quiere seguirte`;
    case 'follow_accept': return `${name} aceptó tu solicitud de seguimiento`;
    case 'social_challenge_invite': return `${name} te ha retado: ${n.data?.title || 'nuevo reto'}`;
    case 'social_challenge_join': return `${name} se ha unido a tu reto`;
    case 'social_challenge_complete': return `Reto completado: ${n.data?.title || 'reto social'} · +${n.data?.points || 0} XP`;
    default: return 'Nueva notificación';
  }
}

// Devuelve { screen, params } para navegar al pulsar la notificación.
export function targetForNotif(n) {
  switch (n.type) {
    case 'follow': return { screen: 'UserProfile', params: { profileId: n.actor_id } };
    case 'like':
    case 'comment': return { screen: 'PostDetail', params: { postId: n.data?.post_id } };
    case 'badge': return { screen: 'Tabs', params: { screen: 'Perfil' } };
    case 'meetup_join': return { screen: 'MeetupDetail', params: { meetupId: n.data?.meetup_id } };
    case 'message': return { screen: 'Conversation', params: { conversationId: n.data?.conversation_id, otherName: actorName(n) } };
    case 'follow_request': return { screen: 'FollowRequests', params: {} };
    case 'follow_accept': return { screen: 'UserProfile', params: { profileId: n.actor_id } };
    case 'social_challenge_invite':
    case 'social_challenge_join':
    case 'social_challenge_complete': return { screen: 'SocialChallenges', params: { challengeId: n.data?.challenge_id } };
    default: return null;
  }
}
