import CacheQueryLink from './CacheQueryLink';
import FilterDirectiveLink from './FilterDirectiveLink';
import { withClientState } from 'apollo-link-state';

export function createCacheQueryLink({
  stateLinkConfig,
  filterOperatorDirectives,
  ...config
}) {
  const cache = stateLinkConfig.cache;

  const cacheQueryLink = new CacheQueryLink({ cache, ...config });

  const resolvers = stateLinkConfig.resolvers(cacheQueryLink);
  const stateLink = withClientState({
    ...stateLinkConfig,
    resolvers,
  });
  const filterDirectiveLink = new FilterDirectiveLink({filterOperatorDirectives});

  return filterDirectiveLink.concat(stateLink.concat(cacheQueryLink));
}
