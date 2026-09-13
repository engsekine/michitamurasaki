import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineTabsSwitcher } from './TimelineTabsSwitcher';

const timelinePanel = <div>タイムライン内容</div>;
const likesPanel = <div>いいね内容</div>;

describe('TimelineTabsSwitcher', () => {
    describe('初期表示', () => {
        it('タブリストに aria-label="閲覧の切り替え" が付与されている', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getByRole('tablist', { name: '閲覧の切り替え' })).toBeInTheDocument();
        });

        it('role="tab" のボタンが2つ存在する', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getAllByRole('tab')).toHaveLength(2);
        });

        it('「タイムライン」タブが aria-selected=true で初期選択されている', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('aria-selected', 'true');
        });

        it('「いいねしたログ」タブが aria-selected=false になっている', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'false');
        });

        it('「タイムライン」タブの tabIndex が 0、「いいねしたログ」タブが -1 になっている', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('tabindex', '0');
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('tabindex', '-1');
        });

        it('タイムラインパネルの内容が表示され、いいねパネルは hidden になっている', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getByText('タイムライン内容')).toBeVisible();
            expect(screen.getByText('いいね内容')).not.toBeVisible();
        });
    });

    describe('aria-controls / id の対応', () => {
        it('各タブの aria-controls が実在するパネルの id を指す', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            for (const name of ['タイムライン', 'いいねしたログ']) {
                const panelId = screen.getByRole('tab', { name }).getAttribute('aria-controls');
                expect(panelId).not.toBeNull();
                expect(panelId && document.getElementById(panelId)).not.toBeNull();
            }
        });
    });

    describe('タブクリックによる切り替え', () => {
        it('「いいねしたログ」タブをクリックすると選択・表示・tabIndex が切り替わる', async () => {
            const user = userEvent.setup();
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);

            await user.click(screen.getByRole('tab', { name: 'いいねしたログ' }));

            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('aria-selected', 'false');
            expect(screen.getByText('いいね内容')).toBeVisible();
            expect(screen.getByText('タイムライン内容')).not.toBeVisible();
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('tabindex', '0');
        });

        it('いいねタブ選択後に「タイムライン」タブをクリックすると元に戻る', async () => {
            const user = userEvent.setup();
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);

            await user.click(screen.getByRole('tab', { name: 'いいねしたログ' }));
            await user.click(screen.getByRole('tab', { name: 'タイムライン' }));

            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByText('タイムライン内容')).toBeVisible();
            expect(screen.getByText('いいね内容')).not.toBeVisible();
        });
    });

    describe('キーボード操作（ArrowRight / ArrowLeft）', () => {
        it('ArrowRight で次のタブへ移動し、末尾からはラップする', async () => {
            const user = userEvent.setup();
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);

            screen.getByRole('tab', { name: 'タイムライン' }).focus();
            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveFocus();

            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveFocus();
        });

        it('ArrowLeft で前のタブへ移動し、先頭からはラップする', async () => {
            const user = userEvent.setup();
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);

            screen.getByRole('tab', { name: 'タイムライン' }).focus();
            await user.keyboard('{ArrowLeft}');
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('tab', { name: 'いいねしたログ' })).toHaveFocus();
        });

        it('矢印キー以外（ArrowUp）はタブ選択に影響しない', async () => {
            const user = userEvent.setup();
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);

            screen.getByRole('tab', { name: 'タイムライン' }).focus();
            await user.keyboard('{ArrowUp}');

            expect(screen.getByRole('tab', { name: 'タイムライン' })).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('パネルの DOM 存在', () => {
        it('両パネルは常に DOM に存在する（hidden で切り替える）', () => {
            render(<TimelineTabsSwitcher timelinePanel={timelinePanel} likesPanel={likesPanel} />);
            expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2);
        });
    });

    describe('props で渡した ReactNode の表示', () => {
        it('timelinePanel / likesPanel に渡した任意の ReactNode が描画される', () => {
            render(
                <TimelineTabsSwitcher timelinePanel={<p>カスタムタイムライン</p>} likesPanel={<p>カスタムいいね</p>} />,
            );
            expect(screen.getByText('カスタムタイムライン')).toBeInTheDocument();
            expect(screen.getByText('カスタムいいね')).toBeInTheDocument();
        });
    });
});
