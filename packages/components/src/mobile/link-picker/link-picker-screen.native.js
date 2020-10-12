/**
 * External dependencies
 */
import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
/**
 * WordPress dependencies
 */
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { LinkPicker } from './';

const LinkPickerScreen = ( { returnScreenName, withPadding } ) => {
	const navigation = useNavigation();
	const route = useRoute();

	const onLinkPicked = ( { url, title } ) => {
		navigation.navigate( returnScreenName, {
			inputValue: url,
			text: title,
		} );
	};

	const onCancel = () => {
		navigation.goBack();
	};

	const { inputValue } = route.params;
	return useMemo( () => {
		return (
			<LinkPicker
				value={ inputValue }
				onLinkPicked={ onLinkPicked }
				onCancel={ onCancel }
				withPadding={ withPadding }
			/>
		);
	}, [ inputValue ] );
};

export default LinkPickerScreen;
