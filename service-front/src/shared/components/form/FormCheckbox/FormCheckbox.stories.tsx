import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormCheckbox } from './FormCheckbox';

const meta = {
    title: 'shared/form/FormCheckbox',
    component: FormCheckbox,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    args: {
        id: 'agree',
        label: '利用規約に同意する',
    },
} satisfies Meta<typeof FormCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Required: Story = {
    args: { required: true },
};

export const WithError: Story = {
    args: { error: '利用規約に同意してください' },
};

export const WithLink: Story = {
    args: {
        label: (
            <>
                <a href="/terms" className="underline">
                    利用規約
                </a>
                に同意する
            </>
        ),
    },
};
