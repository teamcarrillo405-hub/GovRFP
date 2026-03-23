import { createWriteStream } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __dirname = dirname(fileURLToPath(import.meta.url))
const output = createWriteStream(resolve(__dirname, 'sample.docx'))
const archive = archiver('zip')

archive.pipe(output)

archive.append(
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  { name: '[Content_Types].xml' }
)

archive.append(
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  { name: '_rels/.rels' }
)

archive.append(
  '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Section 1. Scope of Work. The contractor shall provide all labor and materials. Section 2. Requirements. The contractor must comply with all federal regulations.</w:t></w:r></w:p></w:body></w:document>',
  { name: 'word/document.xml' }
)

archive.append(
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  { name: 'word/_rels/document.xml.rels' }
)

await archive.finalize()
console.log('sample.docx created')
