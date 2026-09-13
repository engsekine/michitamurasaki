import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

interface InquiryAutoReplyEmailProps {
    name: string;
    /** 種別の表示ラベル（例: ご質問） */
    categoryLabel: string;
    body: string;
}

// メール HTML はメールクライアントの制約上インラインスタイルが前提（Web の Tailwind 規約の例外）。
const sectionStyle = { padding: '0 24px' } as const;
const bodyTextStyle = { whiteSpace: 'pre-wrap' as const };

/** 送信者への自動返信メール（FR-022） */
export const InquiryAutoReplyEmail = ({ name, categoryLabel, body }: InquiryAutoReplyEmailProps) => (
    <Html lang="ja">
        <Head />
        <Preview>お問い合わせを受け付けました</Preview>
        <Body>
            <Container>
                <Heading as="h1">お問い合わせを受け付けました</Heading>
                <Section style={sectionStyle}>
                    <Text>{name} 様</Text>
                    <Text>
                        お問い合わせいただきありがとうございます。以下の内容で受け付けました。内容を確認のうえ、改めてご連絡いたします。
                    </Text>
                </Section>
                <Hr />
                <Section style={sectionStyle}>
                    <Text>種別: {categoryLabel}</Text>
                    <Text>本文:</Text>
                    <Text style={bodyTextStyle}>{body}</Text>
                </Section>
            </Container>
        </Body>
    </Html>
);
