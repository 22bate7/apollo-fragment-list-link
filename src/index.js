import _upperFirst from 'lodash/upperFirst';
import _merge from 'lodash/merge';
import _reduce from 'lodash/reduce';
import _castArray from 'lodash/castArray';

import CacheQueryLink from './CacheQueryLink';
import FilterDirectiveLink from './FilterDirectiveLink';
import { withClientState } from 'apollo-link-state';

export function createCacheQueryLink({
  stateLinkConfig,
  filterOperatorDirectives,
  joinConnection = {},
  ...config
}) {
  const cache = stateLinkConfig.cache;

  const cacheQueryLink = new CacheQueryLink({ cache, ...config });

  const stateLink = withClientState({
    ...stateLinkConfig,
    resolvers: _merge(stateLinkConfig.resolvers, {
      Query: cacheQueryLink.createStateLinkResolvers(),
      ..._reduce(
        joinConnection,
        (accum, nodes, key) => {
          //
          return {
            ...accum,
            [key]: _castArray(nodes).reduce((nodeAccum, item) => {
              const joinKey = _upperFirst(item.field);
              const typename = item.typename;
              const resolverKey = `${cacheQueryLink.createLocalCacheKey({
                typename,
              })}By${joinKey}`;

              const fragment = cacheQueryLink.getFragmentByTypename(typename);
              if (!fragment) {
                return nodeAccum;
              }
              return {
                ...nodeAccum,
                [resolverKey]: (data = {}) =>
                  cache.readFragment({
                    id: `${typename}:${data[item.field]}`,
                    fragment,
                  }),
              };
            }, {}),
          };
          //
        },
        {},
      ),
    }),
  });
  const filterDirectiveLink = new FilterDirectiveLink({
    filterOperatorDirectives,
  });

  return filterDirectiveLink.concat(stateLink.concat(cacheQueryLink));
}
