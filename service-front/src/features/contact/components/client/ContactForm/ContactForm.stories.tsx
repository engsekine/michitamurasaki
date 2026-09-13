import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ContactForm } from './ContactForm';

const meta = {
    title: 'features/contact/ContactForm',
    component: ContactForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未ログイン: 空のフォーム */
export const Empty: Story = {
    args: {
        defaultValues: { name: '', email: '', category: '', body: '', website: '' },
    },
};

/** ログイン中: 氏名・メールが補完された状態（US3） */
export const Prefilled: Story = {
    args: {
        defaultValues: {
            name: '山田太郎',
            email: 'taro@example.com',
            category: '',
            body: '',
            website: '',
        },
    },
};
