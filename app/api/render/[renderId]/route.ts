import { NextResponse } from 'next/server';
import { getRenderProgress } from '@remotion/lambda/client';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ renderId: string }> }
) {
  try {
    const { renderId } = await params;
    const bucketName = _request.headers.get('x-bucket-name');
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    const region = process.env.AWS_REGION || 'us-east-2';

    if (!functionName || !bucketName) {
      return NextResponse.json(
        { error: 'Missing configuration or x-bucket-name header' },
        { status: 400 }
      );
    }

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: region as 'us-east-1' | 'us-east-2' | 'us-west-2' | 'eu-central-1' | 'eu-west-1' | 'ap-southeast-1',
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get progress',
      },
      { status: 500 }
    );
  }
}
