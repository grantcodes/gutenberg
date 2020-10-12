/**
 * Internal dependencies
 */
import apiFetch from '../index';

const BATCH_TIME_WINDOW = 1000;
const MAX_BATCH_SIZE = 20;
const awaitingBatches = {};

/**
 * Middleware handling request batching.
 *
 * @param {Object}   options Fetch options.
 * @param {Function} next    [description]
 *
 * @return {*} The evaluated result of the remaining middleware chain.
 */
function batchRequestMiddleware( options, next ) {
	if (
		! [ 'POST', 'PUT', 'PATCH', 'DELETE' ].includes( options.method ) ||
		! options.batchAs ||
		! endpointSupportsBatch( options.path )
	) {
		return next( options );
	}

	const batchId = JSON.stringify( [ options.batchAs, options.method ] );
	const requestIdx = addRequestToBatch( batchId, options );
	const save = requestIdx + 1 >= MAX_BATCH_SIZE ? commit : commitEventually;
	return save( batchId ).then(
		( subResponses ) => subResponses[ requestIdx ]
	);
}

function endpointSupportsBatch( path ) {
	// This should be more sophisticated in reality:
	return path.indexOf( '/v2/template-parts' ) !== -1;
}

function addRequestToBatch( batchId, options ) {
	if ( ! awaitingBatches[ batchId ] ) {
		awaitingBatches[ batchId ] = {
			promise: null,
			requests: [],
		};
	}

	awaitingBatches[ batchId ].requests.push( options );
	return awaitingBatches[ batchId ].requests.length - 1;
}

function commitEventually( batchId ) {
	const batch = awaitingBatches[ batchId ];
	if ( ! batch.promise ) {
		batch.promise = new Promise( ( resolve ) => {
			setTimeout( () => resolve( commit( batchId ) ), BATCH_TIME_WINDOW );
		} );
	}
	return batch.promise;
}

function commit( batchId ) {
	// Pop unit of work so it cannot be altered by outside code
	const unitOfWork = awaitingBatches[ batchId ];
	delete awaitingBatches[ batchId ];

	// Clear eventual commit in case commit was called before commitEventually kicked in
	clearTimeout( unitOfWork.promise );

	// Maybe we could reuse raw options instead of mapping like that
	const requests = unitOfWork.requests.map( ( options ) => ( {
		path: options.path,
		body: options.body,
		headers: options.headers,
	} ) );

	return apiFetch( {
		path: '/wp/__experimental/batch',
		method: 'POST',
		data: {
			validation: 'require-all-validate',
			requests,
		},
	} );
}

export default batchRequestMiddleware;
