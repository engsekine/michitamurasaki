import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TimelineTabsSwitcher } from './TimelineTabsSwitcher';

const meta = {
    title: 'features/social/TimelineTabsSwitcher',
    component: TimelineTabsSwitcher,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    argTypes: {
        // ReactNode は controls で編集不可のため非表示にする
        timelinePanel: { control: false },
        likesPanel: { control: false },
    },
} satisfies Meta<typeof TimelineTabsSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** タイムライン・いいねしたログ 両パネルにコンテンツがある通常状態 */
export const Default: Story = {
    args: {
        timelinePanel: (
            <div className="flex flex-col gap-4">
                {[
                    { user: 'yamada_diver', spot: '青の洞窟', depth: '18m', date: '2026-07-01' },
                    { user: 'ocean_explorer', spot: '慶良間諸島', depth: '25m', date: '2026-06-28' },
                    { user: 'coral_watcher', spot: '石垣島 名蔵湾', depth: '12m', date: '2026-06-25' },
                ].map((log) => (
                    <div key={log.date} className="rounded-md border border-border p-4">
                        <p className="font-medium text-foreground text-sm">{log.user}</p>
                        <p className="mt-1 text-muted-foreground text-sm">
                            {log.spot} / 最大水深 {log.depth} / {log.date}
                        </p>
                    </div>
                ))}
            </div>
        ),
        likesPanel: (
            <div className="flex flex-col gap-4">
                {[
                    { user: 'sea_turtle_fan', spot: '座間味島', depth: '20m', date: '2026-07-03' },
                    { user: 'manta_lover', spot: '石垣島 川平湾', depth: '30m', date: '2026-06-30' },
                ].map((log) => (
                    <div key={log.date} className="rounded-md border border-border p-4">
                        <p className="font-medium text-foreground text-sm">{log.user}</p>
                        <p className="mt-1 text-muted-foreground text-sm">
                            {log.spot} / 最大水深 {log.depth} / {log.date}
                        </p>
                    </div>
                ))}
            </div>
        ),
    },
};

/** 各パネルがデータなしの空状態メッセージを表示している状態 */
export const EmptyPanels: Story = {
    args: {
        timelinePanel: (
            <div className="rounded-md border border-border p-8 text-center text-muted-foreground text-sm">
                フォロー中のユーザーのログはまだありません
            </div>
        ),
        likesPanel: (
            <div className="rounded-md border border-border p-8 text-center text-muted-foreground text-sm">
                いいねしたログはまだありません
            </div>
        ),
    },
};
