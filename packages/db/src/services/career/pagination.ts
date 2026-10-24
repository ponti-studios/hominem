// The career list routes share the repository-wide keyset cursor codec; these aliases keep the
// career-specific names the route repositories already use.
export {
  PAGE_DEFAULT_LIMIT as CAREER_PAGE_DEFAULT_LIMIT,
  decodePageCursor as decodeCareerCursor,
  encodePageCursor as encodeCareerCursor,
  isRecord,
  toPage as toCareerPage,
  type Page as CareerPage,
} from '../pagination';
