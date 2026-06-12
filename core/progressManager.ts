import { reactive } from 'vue'

export interface ProgressOperation {
    id: string;
    title: string;
    current: number;
    total: number;
    status: 'processing' | 'completed' | 'error';
}

export const ProgressManager = reactive({
    operations: [] as ProgressOperation[],
})

export const startOperation = (id: string, title: string, total: number): ProgressOperation => {
    const operation: ProgressOperation = {
        id,
        title,
        current: 0,
        total,
        status: 'processing'
    }
    ProgressManager.operations.push(operation)
    return operation
}

export const updateOperation = (id: string, current: number) => {
    const operation = ProgressManager.operations.find(op => op.id === id)
    if (operation) {
        operation.current = current
    }
}

export const completeOperation = (id: string) => {
    const operation = ProgressManager.operations.find(op => op.id === id)
    if (operation) {
        operation.status = 'completed'
        setTimeout(() => {
            removeOperation(id)
        }, 5000)
    }
}

export const failOperation = (id: string) => {
    const operation = ProgressManager.operations.find(op => op.id === id)
    if (operation) {
        operation.status = 'error'
        setTimeout(() => {
            removeOperation(id)
        }, 5000)
    }
}

export const removeOperation = (id: string) => {
    const index = ProgressManager.operations.findIndex(op => op.id === id)
    if (index > -1) {
        ProgressManager.operations.splice(index, 1)
    }
}
