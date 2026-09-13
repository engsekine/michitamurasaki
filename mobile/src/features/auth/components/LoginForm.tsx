import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase/client';
import { colors, fontSize, MIN_TOUCH_TARGET, radius, spacing } from '../../../theme/tokens';

/**
 * メール + パスワードのログインフォーム（FR-018）。
 * 初回はオンライン必須（spec Assumption）。失敗理由はフォーム下に alert 相当で表示。
 */
export const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setError(null);
        if (!email.trim() || !password) {
            setError('メールアドレスとパスワードを入力してください');
            return;
        }
        setIsSubmitting(true);
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        setIsSubmitting(false);
        if (signInError) {
            setError('メールアドレスまたはパスワードが間違っています');
        }
        // 成功時は useSession の onAuthStateChange 経由で (auth)/login が Redirect する
    };

    /**
     * Google ログイン（FR-018 / research R6）。
     * PKCE: signInWithOAuth で認可 URL を取得 → アプリ内ブラウザ → ディープリンク（scheme: mobile）で
     * 認可コードを受け取り exchangeCodeForSession でセッション化する。
     * Supabase 側のリダイレクト許可リストに makeRedirectUri の値を登録しておくこと（quickstart 参照）。
     */
    const handleGoogleLogin = async () => {
        if (isSubmitting) return;
        setError(null);
        setIsSubmitting(true);
        try {
            const redirectTo = AuthSession.makeRedirectUri();
            const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo, skipBrowserRedirect: true },
            });
            if (oauthError || !data.url) {
                setError('Google ログインを開始できませんでした。時間をおいて再度お試しください');
                return;
            }
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
            if (result.type !== 'success') return; // キャンセルはエラー表示しない
            const code = new URL(result.url).searchParams.get('code');
            if (!code) {
                setError('Google ログインに失敗しました。時間をおいて再度お試しください');
                return;
            }
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
                setError('Google ログインに失敗しました。時間をおいて再度お試しください');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.container}>
                <Text style={styles.title} accessibilityRole="header">
                    ダイビングログ
                </Text>
                <Text style={styles.subtitle}>Web 版と同じアカウントでログインできます</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>メールアドレス</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        accessibilityLabel="メールアドレス"
                        style={styles.input}
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>パスワード</Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                        accessibilityLabel="パスワード"
                        style={styles.input}
                    />
                </View>

                {error && (
                    <Text accessibilityRole="alert" style={styles.error}>
                        {error}
                    </Text>
                )}

                <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="ログイン"
                    accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                        <Text style={styles.buttonText}>ログイン</Text>
                    )}
                </Pressable>

                <Pressable
                    onPress={() => void handleGoogleLogin()}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Google でログイン"
                    accessibilityState={{ disabled: isSubmitting }}
                    style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
                >
                    <Text style={styles.googleButtonText}>Google でログイン</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    title: {
        color: colors.foreground,
        fontSize: fontSize.xl,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: colors.mutedForeground,
        fontSize: fontSize.sm,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    field: {
        gap: spacing.xs,
    },
    label: {
        color: colors.foreground,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    input: {
        minHeight: MIN_TOUCH_TARGET,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        color: colors.foreground,
        fontSize: fontSize.base,
        backgroundColor: colors.background,
    },
    error: {
        color: colors.destructive,
        fontSize: fontSize.sm,
    },
    button: {
        minHeight: MIN_TOUCH_TARGET + 4,
        borderRadius: radius.md,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        color: colors.primaryForeground,
        fontSize: fontSize.base,
        fontWeight: '700',
    },
    googleButton: {
        minHeight: MIN_TOUCH_TARGET + 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleButtonText: {
        color: colors.foreground,
        fontSize: fontSize.base,
        fontWeight: '700',
    },
});
