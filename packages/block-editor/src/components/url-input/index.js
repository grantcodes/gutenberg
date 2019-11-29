/**
 * External dependencies
 */
import { throttle, isFunction } from 'lodash';
import classnames from 'classnames';
import scrollIntoView from 'dom-scroll-into-view';

/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';
import { useEffect, useState, useRef } from '@wordpress/element';
import { UP, DOWN, ENTER, TAB } from '@wordpress/keycodes';
import { BaseControl, Button, Spinner, withSpokenMessages, Popover } from '@wordpress/components';
import { withInstanceId, withSafeTimeout, compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { isURL } from '@wordpress/url';

// Since URLInput is rendered in the context of other inputs, but should be
// considered a separate modal node, prevent keyboard events from propagating
// as being considered from the input.
const stopEventPropagation = ( event ) => event.stopPropagation();

/**
 * URLInput component.
 *
 * @param label
 * @param instanceId
 * @param className
 * @param isFullWidth
 * @param hasBorder
 * @param placeholder
 * @param value
 * @param autoFocus
 * @param disableSuggestions
 * @param autocompleteRef
 * @param debouncedSpeak
 * @param speak
 * @param onChange
 * @param renderSuggestions
 * @param fetchLinkSuggestions
 * @param handleURLSuggestions
 * @return {*}
 * @constructor
 */
const URLInput = ( {
	label,
	instanceId,
	className,
	isFullWidth,
	hasBorder,
	placeholder = __( 'Paste URL or type to search' ),
	value = '',
	autoFocus = true,
	autocompleteRef = useRef(),
	disableSuggestions,

	debouncedSpeak,
	speak,

	onChange,

	__experimentalRenderSuggestions: renderSuggestions,
	__experimentalFetchLinkSuggestions: fetchLinkSuggestions,
	__experimentalHandleURLSuggestions: handleURLSuggestions,
} ) => {
	const [ suggestions, setSuggestions ] = useState( [] );
	const [ showSuggestions, setShowSuggestions ] = useState( false );
	const [ selectedSuggestion, setSelectedSuggestion ] = useState( null );
	const [ loading, setLoading ] = useState( false );

	const suggestionNodes = [];
	let suggestionsRequest = null;

	const inputRef = useRef();

	useEffect( () => {
		// only have to worry about scrolling selected suggestion into view
		// when already expanded
		let scrollingIntoView = null;

		if ( showSuggestions && selectedSuggestion !== null && ! scrollingIntoView ) {
			scrollingIntoView = true;

			scrollIntoView( suggestionNodes[ selectedSuggestion ], autocompleteRef.current, {
				onlyScrollIfNeeded: true,
			} );

			this.props.setTimeout( () => {
				scrollingIntoView = false;
			}, 100 );
		}

		return () => {
			suggestionsRequest = null;
		}
	}, [] );

	const bindSuggestionNode = ( index ) => {
		return ( ref ) => {
			suggestionNodes[ index ] = ref;
		};
	};

	const updateSuggestionsHanlder = ( value ) => {
		if ( ! fetchLinkSuggestions ) {
			return;
		}

		// Show the suggestions after typing at least 2 characters
		// and also for URLs
		if ( value.length < 2 || ( ! handleURLSuggestions && isURL( value ) ) ) {
			setShowSuggestions( false );
			setSelectedSuggestion( null );
			setLoading( false );
			return;
		}

		setShowSuggestions( true );
		setSelectedSuggestion( null );
		setLoading( true );

		const request = fetchLinkSuggestions( value );

		request.then( ( suggestions ) => {
			// A fetch Promise doesn't have an abort option. It's mimicked by
			// comparing the request reference in on the instance, which is
			// reset or deleted on subsequent requests or unmounting.
			if ( suggestionsRequest !== request ) {
				return;
			}

			setSuggestions( suggestions );
			setLoading( false );

			if ( !! suggestions.length ) {
				debouncedSpeak( sprintf( _n(
					'%d result found, use up and down arrow keys to navigate.',
					'%d results found, use up and down arrow keys to navigate.',
					suggestions.length
				), suggestions.length ), 'assertive' );
			} else {
				debouncedSpeak( __( 'No results.' ), 'assertive' );
			}
		} ).catch( () => {
			if ( suggestionsRequest === request ) {
				setLoading( false );
			}
		} );

		suggestionsRequest = request;
	};

	const updateSuggestions = throttle( updateSuggestionsHanlder, 200 );

	const selectLink = ( suggestion ) => {
		onChange( suggestion.url, suggestion );
		setSelectedSuggestion( null );
		setShowSuggestions( false );
	};

	const onClickHandler = ( suggestion ) => {
		selectLink( suggestion );
		// Move focus to the input field when a link suggestion is clicked.
		inputRef.current.focus();
	};

	const onChangeHandler = ( { target } ) => {
		const { value } = target;
		onChange( value );
		if ( ! disableSuggestions ) {
			updateSuggestions( value );
		}

	};

	const onKeyDownHandler = ( event ) => {
		// If the suggestions are not shown or loading, we shouldn't handle the arrow keys
		// We shouldn't preventDefault to allow block arrow keys navigation
		if (
			( ! showSuggestions || ! suggestions.length || loading ) &&
			value
		) {
			// In the Windows version of Firefox the up and down arrows don't move the caret
			// within an input field like they do for Mac Firefox/Chrome/Safari. This causes
			// a form of focus trapping that is disruptive to the user experience. This disruption
			// only happens if the caret is not in the first or last position in the text input.
			// See: https://github.com/WordPress/gutenberg/issues/5693#issuecomment-436684747
			switch ( event.keyCode ) {
				// When UP is pressed, if the caret is at the start of the text, move it to the 0
				// position.
				case UP: {
					if ( 0 !== event.target.selectionStart ) {
						event.stopPropagation();
						event.preventDefault();

						// Set the input caret to position 0
						event.target.setSelectionRange( 0, 0 );
					}
					break;
				}
				// When DOWN is pressed, if the caret is not at the end of the text, move it to the
				// last position.
				case DOWN: {
					if ( value.length !== event.target.selectionStart ) {
						event.stopPropagation();
						event.preventDefault();

						// Set the input caret to the last position
						event.target.setSelectionRange( value.length, value.length );
					}
					break;
				}
			}

			return;
		}

		const suggestion = suggestions[ selectedSuggestion ];

		switch ( event.keyCode ) {
			case UP: {
				event.stopPropagation();
				event.preventDefault();
				const previousIndex = ! selectedSuggestion ? suggestions.length - 1 : selectedSuggestion - 1;
				setSelectedSuggestion( previousIndex );
				break;
			}
			case DOWN: {
				event.stopPropagation();
				event.preventDefault();
				const nextIndex = selectedSuggestion === null || ( selectedSuggestion === suggestions.length - 1 ) ? 0 : selectedSuggestion + 1;
				setSelectedSuggestion( nextIndex );
				break;
			}
			case TAB: {
				if ( selectedSuggestion !== null ) {
					selectLink( suggestion );
					// Announce a link has been selected when tabbing away from the input field.
					speak( __( 'Link selected.' ) );
				}
				break;
			}
			case ENTER: {
				if ( selectedSuggestion !== null ) {
					event.stopPropagation();
					selectLink( suggestion );
				}
				break;
			}
		}
	};

	// pre-rendering.
	const id = `url-input-control-${ instanceId }`;
	const suggestionsListboxId = `block-editor-url-input-suggestions-${ instanceId }`;
	const suggestionOptionIdPrefix = `block-editor-url-input-suggestion-${ instanceId }`;

	const suggestionsListProps = {
		id: suggestionsListboxId,
		ref: autocompleteRef,
		role: 'listbox',
	};

	const buildSuggestionItemProps = ( suggestion, index ) => {
		return {
			role: 'option',
			tabIndex: '-1',
			id: `${ suggestionOptionIdPrefix }-${ index }`,
			ref: bindSuggestionNode( index ),
			'aria-selected': index === selectedSuggestion,
		};
	};

	return (
		<BaseControl
			label={ label }
			id={ id }
			className={ classnames( 'editor-url-input block-editor-url-input', className, {
				'is-full-width': isFullWidth,
				'has-border': hasBorder,
			} ) }
		>
			<input
				autoFocus={ autoFocus }
				type="text"
				aria-label={ __( 'URL' ) }
				required
				value={ value }
				onChange={ onChangeHandler }
				onInput={ stopEventPropagation }
				placeholder={ placeholder }
				onKeyDown={ onKeyDownHandler }
				role="combobox"
				aria-expanded={ showSuggestions }
				aria-autocomplete="list"
				aria-owns={ suggestionsListboxId }
				aria-activedescendant={
					selectedSuggestion !== null
						? `${ suggestionOptionIdPrefix }-${ selectedSuggestion }`
						: undefined
				}
				ref={ inputRef }
			/>

			{ ( loading ) && <Spinner /> }

			{ isFunction( renderSuggestions ) && showSuggestions && !! suggestions.length && renderSuggestions( {
				suggestions,
				selectedSuggestion,
				suggestionsListProps,
				buildSuggestionItemProps,
				isLoading: loading,
				handleSuggestionClick: onClickHandler(),
			} ) }

			{ ! isFunction( renderSuggestions ) && showSuggestions && !! suggestions.length &&
			<Popover
				position="bottom"
				noArrow
				focusOnMount={ false }
			>
				<div
					{ ...suggestionsListProps }
					className={ classnames(
						'block-editor-url-input__suggestions',
						`${ className }__suggestions`
					) }
				>
					{ suggestions.map( ( suggestion, index ) => (
						<button
							{ ...buildSuggestionItemProps( suggestion, index ) }
							key={ suggestion.id }
							className={ classnames( 'block-editor-url-input__suggestion', {
								'is-selected': index === selectedSuggestion,
							} ) }
							onClick={ () => onClickHandler( suggestion ) }
						>
							{ suggestion.title }
						</button>
					) ) }
				</div>
			</Popover>
			}
		</BaseControl>
	);
	/* eslint-enable jsx-a11y/no-autofocus */
};

	//
	// static getDerivedStateFromProps( { value, disableSuggestions }, { showSuggestions, selectedSuggestion } ) {
	// 	let shouldShowSuggestions = showSuggestions;
	//
	// 	const hasValue = value && value.length;
	//
	// 	if ( ! hasValue ) {
	// 		shouldShowSuggestions = false;
	// 	}
	//
	// 	if ( disableSuggestions === true ) {
	// 		shouldShowSuggestions = false;
	// 	}
	//
	// 	return {
	// 		selectedSuggestion: hasValue ? selectedSuggestion : null,
	// 		showSuggestions: shouldShowSuggestions,
	// 	};
	// }
// }

export default compose(
	withSafeTimeout,
	withSpokenMessages,
	withInstanceId,
	withSelect( ( select, props ) => {
		// If a link suggestions handler is already provided then
		// bail
		if ( isFunction( props.__experimentalFetchLinkSuggestions ) ) {
			return;
		}
		const { getSettings } = select( 'core/block-editor' );
		return {
			__experimentalFetchLinkSuggestions: getSettings().__experimentalFetchLinkSuggestions,
		};
	} )
)( URLInput );
