/** Kids Add/수정 모달 평상시 장식. 폴더 전체 사용. 스키마/권한과 무관. */

/**
 * 네 모서리와 테두리(위·아래·좌·우)에 둔다.
 * 가운데 제목·날짜·입력·반복·버튼 위에는 두지 않는다.
 * 좌우 테두리는 여백(px-11) 안에만 둔다.
 */
export const KIDS_ADD_DECOS: { src: string; className: string }[] = [
  // 왼쪽 위 — 제목 왼쪽, 시작 날짜 위
  { src: '/family-calendar/add-emojis/cloud.png', className: 'top-1 left-1/2 w-11 -translate-x-1/2' },
  { src: '/family-calendar/add-emojis/book.png', className: 'top-1 left-14 w-9 -rotate-12' },
  { src: '/family-calendar/add-emojis/star-small.png', className: 'top-8 left-10 w-4' },
  { src: '/family-calendar/add-emojis/shooting-stars-2.png', className: 'top-6 left-[9%] w-10 rotate-[-16deg]' },
  { src: '/family-calendar/add-emojis/star.png', className: 'top-3 left-[20%] w-5 rotate-12' },
  { src: '/family-calendar/add-emojis/rainbow.png', className: 'top-12 left-0 w-11 rotate-[-8deg]' },
  { src: '/family-calendar/add-emojis/firework.png', className: 'top-16 left-1 w-8 -rotate-6' },

  // 오른쪽 위 — 제목 오른쪽, 종료 날짜 위
  { src: '/family-calendar/add-emojis/rainbow-house.png', className: 'top-0.5 right-1 w-11 rotate-6' },
  { src: '/family-calendar/add-emojis/seven-star.png', className: 'top-1 right-14 w-8' },
  { src: '/family-calendar/add-emojis/puppy.png', className: 'top-10 right-1 w-9 rotate-12' },
  { src: '/family-calendar/add-emojis/stroller.png', className: 'top-9 right-[18%] w-8 -rotate-6' },
  { src: '/family-calendar/add-emojis/saturn-big.png', className: 'top-14 right-12 w-9 rotate-[-8deg]' },
  { src: '/family-calendar/add-emojis/stars-4.png', className: 'top-12 right-[26%] w-5' },

  // 왼쪽 아래 — 취소 버튼 왼쪽과 그 아래
  { src: '/family-calendar/add-emojis/mic.png', className: 'bottom-[4.75rem] left-1 w-7 rotate-6' },
  { src: '/family-calendar/add-emojis/books.png', className: 'bottom-14 left-8 w-8 -rotate-6' },
  { src: '/family-calendar/add-emojis/ghost.png', className: 'bottom-3 left-1 w-8 rotate-[-8deg]' },
  { src: '/family-calendar/add-emojis/robot.png', className: 'bottom-2 left-11 w-8' },
  { src: '/family-calendar/add-emojis/bicycle.png', className: 'bottom-1 left-[20%] w-9' },
  { src: '/family-calendar/add-emojis/stars-3.png', className: 'bottom-6 left-[16%] w-5' },
  { src: '/family-calendar/add-emojis/firework-2.png', className: 'bottom-[4.25rem] left-9 w-7 -rotate-12' },

  // 오른쪽 아래 — 추가 버튼 오른쪽과 그 아래
  { src: '/family-calendar/add-emojis/rocket-2.png', className: 'bottom-16 right-10 w-8 rotate-[-18deg]' },
  { src: '/family-calendar/add-emojis/milk.png', className: 'bottom-3 right-[22%] w-7' },
  { src: '/family-calendar/add-emojis/house.png', className: 'bottom-2 right-12 w-8' },
  { src: '/family-calendar/add-emojis/ghost-2.png', className: 'bottom-2 right-1 w-8 rotate-12' },
  { src: '/family-calendar/add-emojis/saturn-star.png', className: 'bottom-7 right-[18%] w-7 -rotate-6' },
  { src: '/family-calendar/add-emojis/stars-2.png', className: 'bottom-1.5 left-1/2 w-7 -translate-x-1/2' },

  // 왼쪽 테두리 — 입력칸 왼쪽 여백
  { src: '/family-calendar/add-emojis/earth.png', className: 'top-[32%] left-0.5 w-7' },
  { src: '/family-calendar/add-emojis/moon.png', className: 'top-[44%] left-0.5 w-6 -rotate-12' },
  { src: '/family-calendar/add-emojis/stars.png', className: 'top-[56%] left-0.5 w-7' },
  { src: '/family-calendar/add-emojis/heart.png', className: 'top-[68%] left-1 w-5' },

  // 오른쪽 테두리 — 입력칸 오른쪽 여백
  { src: '/family-calendar/add-emojis/saturn-small.png', className: 'top-[34%] right-0.5 w-7 rotate-12' },
  { src: '/family-calendar/add-emojis/sun.png', className: 'top-[46%] right-0.5 w-6 rotate-6' },
  { src: '/family-calendar/add-emojis/rocket-small.png', className: 'top-[58%] right-0.5 w-7 rotate-[22deg]' },
  { src: '/family-calendar/add-emojis/earth-stars.png', className: 'top-[70%] right-0.5 w-7 rotate-6' },
  { src: '/family-calendar/add-emojis/purple-star.png', className: 'top-[80%] right-1 w-4' },
];
