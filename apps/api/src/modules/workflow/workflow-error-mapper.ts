import {
  AllModelsFailedError,
  LLMAuthError,
  LLMCancelledError,
  LLMError,
  LLMNetworkError,
  LLMRateLimitError,
  LLMSchemaValidationError,
  LLMTimeoutError,
} from '@ai-planning/llm-orchestrator';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';

export function mapLlmError(error: unknown): void {
  if (error instanceof LLMCancelledError) throw error;
  if (error instanceof AllModelsFailedError) {
    throw AppException.internal(
      '所有模型服务当前均不可用，请稍后重试。',
      ErrorCode.ALL_MODELS_FAILED,
    );
  }
  if (error instanceof LLMTimeoutError) {
    throw AppException.internal('模型响应超时，请稍后重试。', ErrorCode.LLM_TIMEOUT);
  }
  if (error instanceof LLMRateLimitError) {
    throw AppException.internal('请求过于频繁，请稍后再试。', ErrorCode.RATE_LIMITED);
  }
  if (error instanceof LLMAuthError) {
    throw AppException.internal(
      '模型服务配置无效，请联系管理员检查 API Key。',
      ErrorCode.LLM_ERROR,
    );
  }
  if (error instanceof LLMSchemaValidationError) {
    throw AppException.internal('模型返回的数据无法处理，请重新运行工作流。', ErrorCode.LLM_ERROR);
  }
  if (error instanceof LLMNetworkError) {
    throw AppException.internal('暂时无法连接模型服务，请稍后重试。', ErrorCode.LLM_NETWORK_ERROR);
  }
  if (error instanceof LLMError) {
    throw AppException.internal('模型服务暂时不可用，请稍后重试。', ErrorCode.LLM_ERROR);
  }
  if (error instanceof Error && error.message.includes('Cost limit exceeded')) {
    throw AppException.costLimitExceeded();
  }
}
