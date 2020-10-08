/**
 * Internal dependencies
 */
import InserterPanel from './inserter-panel';

const LeftSidebar = ( { content, setContent } ) => {
	if ( content === 'inserter' ) {
		return <InserterPanel closeInserter={ () => setContent( null ) } />;
	}

	return null;
};

export default LeftSidebar;
