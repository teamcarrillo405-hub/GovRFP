import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract'

const MAX_TEXTRACT_BYTES = 10_485_760 // 10MB sync API limit

export async function extractTextract(fileBytes: Uint8Array): Promise<string> {
  if (fileBytes.byteLength > MAX_TEXTRACT_BYTES) {
    throw new Error(
      `File size ${(fileBytes.byteLength / 1_048_576).toFixed(1)}MB exceeds Textract sync limit of 10MB. ` +
      `Please upload a smaller file or a text-based PDF.`,
    )
  }

  const client = new TextractClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  const command = new DetectDocumentTextCommand({
    Document: { Bytes: fileBytes },
  })

  const response = await client.send(command)

  const lines = (response.Blocks ?? [])
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text ?? '')

  return lines.join('\n')
}
