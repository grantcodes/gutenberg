/**
 * Internal dependencies
 */
import InserterPanel from './inserter-panel';

// TODO: Remove remnants of conditional rendering for nav sidebar
const LeftSidebar = ( { content, setContent } ) => {
	// if ( content === 'navigation' ) {
	// 	return <NavigationPanel />;
	// }

	if ( content === 'inserter' ) {
		return <InserterPanel closeInserter={ () => setContent( null ) } />;
	}

	return null;
};

export default LeftSidebar;
