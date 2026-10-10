export type CanonicalCategory = {
  code: string;
  name: string;
};

export const CANONICAL_EVENT_CATEGORIES: CanonicalCategory[] = [
  { code: 'CONFERENCE', name: 'Hội nghị' },
  { code: 'SEMINAR', name: 'Hội thảo' },
  { code: 'WORKSHOP', name: 'Workshop' },
  { code: 'EXHIBITION', name: 'Triển lãm' },
  { code: 'FESTIVAL', name: 'Lễ hội' },
  { code: 'NETWORKING', name: 'Kết nối / Networking' },
  { code: 'HACKATHON', name: 'Hackathon' },
  { code: 'COMPETITION', name: 'Cuộc thi' },
  { code: 'TRAINING', name: 'Đào tạo' },
  { code: 'CAREER_FAIR', name: 'Ngày hội việc làm' },
  { code: 'COMMUNITY', name: 'Cộng đồng' },
  { code: 'CHARITY', name: 'Thiện nguyện' },
  { code: 'MUSIC', name: 'Âm nhạc' },
  { code: 'SPORTS', name: 'Thể thao' },
  { code: 'TECHNOLOGY', name: 'Công nghệ' },
  { code: 'EDUCATION', name: 'Giáo dục' },
  { code: 'BUSINESS', name: 'Kinh doanh' },
  { code: 'ENVIRONMENT', name: 'Môi trường' },
  { code: 'OTHER', name: 'Khác' },
];

export const CANONICAL_CATEGORY_CODE_BY_NAME = new Map(
  CANONICAL_EVENT_CATEGORIES.map((category) => [
    category.name,
    category.code,
  ]),
);

export const CANONICAL_CATEGORY_ORDER_BY_CODE = new Map(
  CANONICAL_EVENT_CATEGORIES.map((category, index) => [
    category.code,
    index,
  ]),
);
