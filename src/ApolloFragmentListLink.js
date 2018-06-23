import { ApolloLink, Observable } from "apollo-link";
import gql from "graphql-tag";

import {
  getOperationDefinition,
  getFragmentDefinition,
  getFragmentDefinitions,
  createFragmentMap
} from "apollo-utilities";

import { iterateOnTypename, createTransformerCacheIdValueNode } from "./utils";
import traverseSelections from "./traverse";

function writeAllFragmentsToCache(
  cache,
  query,
  {
    result,
    context,
    variables,
    output = {},
    createLocalCacheKey,
    createConnectionTypename
  } = {}
) {
  const document = cache.transformDocument(query);
  const operationDefinition = getOperationDefinition(document);
  const fragmentMap = createFragmentMap(getFragmentDefinitions(document));
  const selectionSet = operationDefinition.selectionSet;

  traverseSelections(selectionSet, result, {
    fragmentMap,
    variables,
    context,
    output
  });

  const resolvedFragmentIds = Object.keys(output);
  const currentData = iterateOnTypename({
    resolvedFragmentIds,
    createLocalCacheKey,
    createConnectionTypename,
    getValueOnTypename: ({ localCacheKey, typename }) => {
      try {
        const { keys = { nodes: [] } } = cache.readQuery({
          query: gql`{
                keys:  ${localCacheKey} @client {
                    totalCount
                    nodes
                }
                }`
        });
        const transformer = createTransformerCacheIdValueNode(cache, typename);
        return (keys.nodes || []).map(transformer);
      } catch (error) {
        return [];
      }
    }
  });

  const data = iterateOnTypename({
    resolvedFragmentIds,
    createLocalCacheKey,
    createConnectionTypename,
    getValueOnTypename: ({ typename } = {}) => {
      const values = output[typename] || {};
      return Object.values(values);
    },
    initial: currentData
  });

  cache.writeData({ data });
}

/**
 *  Afterware for apollo-http-link
 */
class ApolloFragmentListLink extends ApolloLink {
  constructor({
    cache,
    createLocalCacheKey,
    createConnectionTypename,
    fragmentTypeDefs = []
  }) {
    super();
    this.cache = cache;
    this.createLocalCacheKey =
      createLocalCacheKey || this._defaultCreateLocalCacheKey;
    this.fragmentTypeDefs = fragmentTypeDefs;
    this.createConnectionTypename =
      createConnectionTypename || this._defaultCreateConnectionTypename;
  }

  _defaultCreateLocalCacheKey = ({ typename }) => {
    return `all${typename}`;
  };

  _defaultCreateConnectionTypename = ({ typename }) => {
    return `All${typename}Connection`;
  };

  createStateLinkResolvers = () => {
    return this.fragmentTypeDefs.reduce((accum, fragmentTypeDef) => {
      const fragmentDefinition = getFragmentDefinition(fragmentTypeDef);
      const typename = fragmentDefinition.typeCondition.name.value;
      const localCacheKey = this.createLocalCacheKey({ typename });

      return {
        ...accum,
        ...{
          [localCacheKey]: () =>
            this._createResolver({
              typename,
              fragment: fragmentTypeDef,
              name: fragmentDefinition.name.value
            })
        }
      };
    }, {});
  };

  _createResolver = ({ typename, fragment, name } = {}) => {
    const localCacheKey = this.createLocalCacheKey({ typename });
    //TODO ask for fragment
    const query = gql`
      query fetchResult{
        result: ${localCacheKey} @client {
            nodes {
               ...${name}
            }
            totalCount
        }
      }     
      ${fragment} 
    `;
    const cache = this.cache;
    let result = {
      nodes: [],
      totalCount: 0,
      __typename: this.createConnectionTypename({ typename })
    };

    try {
      const data = cache.readQuery({ query });
      result = data.result || [];
    } catch (ex) {}

    return result;
  };

  request(operation, forward) {
    return new Observable(observer => {
      let subscription;
      try {
        subscription = forward(operation).subscribe({
          next: result => {
            observer.next(result);
            writeAllFragmentsToCache(this.cache, operation.query, {
              result: result.data,
              variables: operation.variables,
              context: operation.getContext(),
              createLocalCacheKey: this.createLocalCacheKey,
              createConnectionTypename: this.createConnectionTypename
            });
          },
          error: networkError => {
            observer.error(networkError);
          },
          complete: () => {
            observer.complete.bind(observer)();
          }
        });
      } catch (error) {
        observer.error(error);
      }
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }
}

export default ApolloFragmentListLink;
