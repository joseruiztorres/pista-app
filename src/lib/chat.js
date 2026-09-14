import { supabase } from './supabase';

// Busca una conversación 1-a-1 ya existente entre estos dos perfiles;
// si no hay ninguna, crea la conversación y añade a los dos participantes.
export async function getOrCreateConversation(userId, otherProfileId) {
  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', userId);
  const myIds = (mine || []).map((r) => r.conversation_id);

  if (myIds.length) {
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', otherProfileId)
      .in('conversation_id', myIds);
    if (shared && shared.length) return shared[0].conversation_id;
  }

  const { data: convo, error } = await supabase.from('conversations').insert({}).select().single();
  if (error) throw error;

  const { error: partError } = await supabase.from('conversation_participants').insert([
    { conversation_id: convo.id, profile_id: userId },
    { conversation_id: convo.id, profile_id: otherProfileId },
  ]);
  if (partError) throw partError;

  return convo.id;
}
