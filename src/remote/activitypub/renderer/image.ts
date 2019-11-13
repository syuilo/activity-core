export default (file: {
	url: string;
	isSensitive: boolean;
}) => ({
	type: 'Image',
	url: file.url,
	sensitive: file.isSensitive
});
