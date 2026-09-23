import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import PostCard from '../components/PostCard';

const POST_SELECT = '*, profiles:author_id(username, display_name), post_media(url, position, media_type), comments(count)';

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);

  const load = useCallback(async () => {
    const { data: postRow } = await supabase.from('posts')
      .select(POST_SELECT)
      .eq('id', postId).maybeSingle();
    setPost(postRow || null);

    const { data: commentRows } = await supabase.from('comments')
      .select('*, profiles:author_id(username, display_name)')
      .eq('post_id', postId).order('created_at', { ascending: true });
    setComments(commentRows || []);

    if (user) {
      const { data: likeRow } = await supabase.from('likes').select('post_id')
        .eq('post_id', postId).eq('profile_id', user.id).maybeSingle();
      setLiked(!!likeRow);
    }
  }, [postId, user]);

  useEffect(() => { load(); }, [load]);

  async function toggleLike() {
    if (!user || !post) return;
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('profile_id', user.id);
      setLiked(false);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, profile_id: user.id });
      setLiked(true);
    }
  }

  async function sendComment() {
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: user.id, body: text.trim() });
    if (!error) { setText(''); load(); }
    setSending(false);
  }

  async function deleteComment(commentId) {
    await supabase.from('comments').delete().eq('id', commentId).eq('author_id', user.id);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  if (!post) return <View style={styles.screen} />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <PostCard
              post={post}
              liked={liked}
              onToggleLike={toggleLike}
              onPressAuthor={(profileId) => navigation.navigate('UserProfile', { profileId })}
              onPressRoute={(routePostId) => navigation.navigate('ActivityDetail', { postId: routePostId })}
              onEdit={(p) => navigation.navigate('EditPost', { post: p })}
              onChanged={() => { load(); navigation.goBack(); }}
            />
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Sé el primero en comentar.</Text>}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commentAuthor}>{item.profiles?.display_name || item.profiles?.username}</Text>
              <Text style={styles.commentBody}>{item.body}</Text>
            </View>
            {user?.id === item.author_id && (
              <Pressable hitSlop={8} onPress={() => deleteComment(item.id)}>
                <Ionicons name="trash-outline" size={15} color={colors.textDim} />
              </Pressable>
            )}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Escribe un comentario…" placeholderTextColor={colors.textDim}
          value={text} onChangeText={setText} />
        <Pressable style={styles.sendBtn} onPress={sendComment} disabled={sending || !text.trim()}>
          <Text style={styles.sendBtnText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 10 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 10 },
  commentAuthor: { color: colors.text, fontSize: 12, fontWeight: '700' },
  commentBody: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
});
