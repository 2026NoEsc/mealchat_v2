jest.mock('../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from '../src/lib/supabase';
import { createRoomSettlement } from '../src/lib/settlements';

const mockRpc = supabase.rpc as jest.Mock;

describe('settlement v2 RPC contract', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('uses v2 so the current client gets atomic fixed events without changing v1', async () => {
    mockRpc.mockResolvedValue({ data: 'bill-42', error: null });

    await expect(
      createRoomSettlement({
        roomId: 'room-7',
        title: '저녁',
        amount: 24000,
        bankName: null,
        accountNumber: null,
        accountHolder: null,
      }),
    ).resolves.toEqual({ billId: 'bill-42', error: null });

    expect(mockRpc).toHaveBeenCalledWith('create_room_settlement_v2', {
      target_room: 'room-7',
      bill_title: '저녁',
      amount: 24000,
      bank_name: null,
      account_number: null,
      account_holder: null,
    });
  });
});
