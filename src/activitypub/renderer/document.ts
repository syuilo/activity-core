import { File } from '../../../models/entities/drive-file';
import { Files } from '../../models';

export default (file: File) => ({
	type: 'Document',
	mediaType: file.type,
	url: Files.getPublicUrl(file)
});
