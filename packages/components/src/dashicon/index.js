function Dashicon( { icon, className, ...extraProps } ) {
	const iconClass = [
		'dashicon',
		'dashicons',
		'dashicons-' + icon,
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	return <span className={ iconClass } { ...extraProps } />;
}

export default Dashicon;
