export class CardItemDto {
  key: string;
  title: string;
  value: number;
}

export class LineChartItemDto {
  label: string;
  value: number;
}

export class PieChartItemDto {
  label: string;
  value: number;
}

export class DashboardDto {
  cards: CardItemDto[];
  lineChart: LineChartItemDto[];
  pieChart: PieChartItemDto[];
}