import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

interface InquiryNotificationEmailProps {
    name: string;
    email: string;
    /** 種別の表示ラベル（例: ご質問） */
    categoryLabel: string;
    body: string;
}

// メール HTML はメールクライアントの制約上インラインスタイルが前提（Web の Tailwind 規約の例外）。
const sectionStyle = { padding: '0 24px' } as const;
const bodyTextStyle = { whiteSpace: 'pre-wrap' as const };

/** 運営者への通知メール（FR-021） */
export const InquiryNotificationEmail = ({ name, email, categoryLabel, body }: InquiryNotificationEmailProps) => (
    <Html lang="ja">
        <Head />
        <Preview>{`新しいお問い合わせ（${categoryLabel}）が届きました`}</Preview>
        <Body>
            <Container>
                <Heading as="h1">お問い合わせを受け付けました</Heading>
                <Section style={sectionStyle}>
                    <Text>種別: {categoryLabel}</Text>
                    <Text>お名前: {name}</Text>
                    <Text>メールアドレス: {email}</Text>
                </Section>
                <Hr />
                <Section style={sectionStyle}>
                    <Text>本文:</Text>
                    <Text style={bodyTextStyle}>{body}</Text>
                </Section>
            </Container>
        </Body>
    </Html>
);
