import { parseChatChart } from './chat-chart';

describe('parseChatChart', () => {
  it('accepts a bounded numeric chart', () => {
    expect(
      parseChatChart({
        kind: 'line',
        title: 'Books added over time',
        series: [
          {
            name: 'Books',
            data: [
              { label: '2026-06', value: 4 },
              { label: '2026-07', value: 7 },
            ],
          },
        ],
      }),
    ).toMatchObject({ kind: 'line', title: 'Books added over time' });
  });

  it('rejects non-finite values', () => {
    expect(() =>
      parseChatChart({
        kind: 'bar',
        title: 'Invalid chart',
        series: [{ name: 'Books', data: [{ label: 'Now', value: Infinity }] }],
      }),
    ).toThrow();
  });
});
