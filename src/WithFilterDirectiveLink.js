import { ApolloLink, Observable } from 'apollo-link';
import graphql from 'graphql-anywhere';
import _get from 'lodash/get';

import { processArgs } from './utils';

function getResolvedData(resultKey, context, rootValue) {
  if (!rootValue) {
    return context[resultKey];
  }
  return rootValue[resultKey];
}


class WithFilterDirectiveLink extends ApolloLink {
  constructor({ filterOperatorDirectives  } = {}) {
    super();
    this.filterOperatorDirectives = filterOperatorDirectives;
  }
  //
  _filterResolver = (fieldName, rootValue, args, context, info) => {
    const resultKey = info.resultKey || fieldName;
    const resolvedData = getResolvedData(resultKey, context, rootValue);
    const withFilterDirective = _get(info, ['directives', 'filter', 'with']);
    if (withFilterDirective && resolvedData.nodes) {
      return processArgs(
        resolvedData,
        {with: withFilterDirective},
        { operators: this.filterOperatorDirectives },
      );
    }
    return resolvedData;
  };

  request(operation, forward) {
    return new Observable(observer => {
      let subscription;
      try {
        subscription = forward(operation).subscribe({
          next: result => {
            if (!result.data) {
              observer.next(result);
            }
            const processedData = graphql(
              this._filterResolver,
              operation.query,
              null,
              result.data,
              operation.variables,
            );
            observer.next({
              ...result,
              data: { ...result.data, ...processedData },
            });
          },
          error: networkError => {
            observer.error(networkError);
          },
          complete: () => {
            observer.complete.bind(observer)();
          },
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

export default WithFilterDirectiveLink;
