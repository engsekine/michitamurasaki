import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TermsAgreementField } from './TermsAgreementField';

const meta = {
    title: 'features/auth/TermsAgreementField',
    component: TermsAgreementField,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    args: {
        id: 'agreedToTerms',
    },
} satisfies Meta<typeof TermsAgreementField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
    args: { error: '利用規約に同意してください' },
};
